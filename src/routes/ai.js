const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const OllamaService = require('../services/ollamaService');

// Initialize the Ollama service
const ollamaService = new OllamaService();

/**
 * Generate MCP commands based on a user request
 * POST /api/ai/generate-command
 */
router.post('/generate-command', async (req, res) => {
  try {
    const { request, tools, mcpServer } = req.body;

    if (!request) {
      return res.status(400).json({ error: 'Request is required' });
    }

    logger.info(`Generating commands for request: ${request}`);

    // Create a prompt for the AI model
    const prompt = createCommandGenerationPrompt(request, tools, mcpServer);

    // Call the AI model to generate commands
    const modelId = process.env.OLLAMA_MODEL_ID || 'llama3';
    const aiResponse = await ollamaService.chat(modelId, [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user }
    ]);

    if (!aiResponse.success) {
      logger.error(`Error generating commands: ${aiResponse.error}`);
      return res.status(500).json({ error: 'Failed to generate commands' });
    }

    // Parse the AI response to extract commands
    const commands = parseCommandsFromAIResponse(aiResponse.response);

    return res.json({ commands });
  } catch (error) {
    logger.error(`Error in generate-command endpoint: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Analyze the result of a command execution
 * POST /api/ai/analyze-result
 */
router.post('/analyze-result', async (req, res) => {
  try {
    const { result, originalRequest, toolName, parameters } = req.body;

    if (!result || !originalRequest || !toolName) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    logger.info(`Analyzing result for tool: ${toolName}`);

    // Create a prompt for the AI model
    const prompt = createResultAnalysisPrompt(result, originalRequest, toolName, parameters);

    // Call the AI model to analyze the result
    const modelId = process.env.OLLAMA_MODEL_ID || 'llama3';
    const aiResponse = await ollamaService.chat(modelId, [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user }
    ]);

    if (!aiResponse.success) {
      logger.error(`Error analyzing result: ${aiResponse.error}`);
      return res.status(500).json({ error: 'Failed to analyze result' });
    }

    // Parse the AI response to extract analysis and follow-up commands
    const analysis = parseAnalysisFromAIResponse(aiResponse.response);

    return res.json(analysis);
  } catch (error) {
    logger.error(`Error in analyze-result endpoint: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create a prompt for command generation
 */
function createCommandGenerationPrompt(request, tools, mcpServer) {
  // Create a description of available tools
  const toolsDescription = tools.map(tool => {
    return `
Tool: ${tool.name}
Description: ${tool.description}
Parameters: ${JSON.stringify(tool.parameters, null, 2)}
    `;
  }).join('\n');

  // Create the system prompt
  const systemPrompt = `
You are an AI assistant that helps users interact with an MCP (Management Control Protocol) server.
Your task is to generate appropriate commands based on the user's request.

The MCP server is running at ${mcpServer.host}:${mcpServer.port}.

Available tools:
${toolsDescription}

When generating commands, follow these guidelines:
1. Choose the most appropriate tool for the user's request
2. Provide a clear description of what the command will do
3. Format the parameters correctly according to the tool's requirements
4. If multiple steps are needed, generate multiple commands in the correct order
5. If the request is ambiguous, generate the most likely command based on the context

Your response should be in JSON format with the following structure:
{
  "commands": [
    {
      "command": "A human-readable description of the command",
      "toolName": "The name of the tool to use",
      "parameters": { ... parameters for the tool ... },
      "description": "A detailed explanation of what this command will do and why it's appropriate"
    },
    ...
  ]
}
  `;

  // Create the user prompt
  const userPrompt = `
User request: ${request}

Generate appropriate MCP commands to fulfill this request.
  `;

  return {
    system: systemPrompt,
    user: userPrompt
  };
}

/**
 * Create a prompt for result analysis
 */
function createResultAnalysisPrompt(result, originalRequest, toolName, parameters) {
  // Create the system prompt
  const systemPrompt = `
You are an AI assistant that helps users interact with an MCP (Management Control Protocol) server.
Your task is to analyze the result of a command execution and provide insights to the user.

When analyzing results, follow these guidelines:
1. Explain what the result means in plain language
2. Highlight any important information or errors
3. Suggest follow-up actions if appropriate
4. If the result indicates an error, suggest possible solutions
5. If the result is successful, explain what was accomplished

Your response should be in JSON format with the following structure:
{
  "analysis": "A detailed analysis of the result",
  "followUpCommands": [
    {
      "command": "A human-readable description of the follow-up command",
      "toolName": "The name of the tool to use",
      "parameters": { ... parameters for the tool ... },
      "description": "A detailed explanation of what this command will do and why it's appropriate"
    },
    ...
  ]
}
  `;

  // Create the user prompt
  const userPrompt = `
Original request: ${originalRequest}
Tool executed: ${toolName}
Parameters: ${JSON.stringify(parameters, null, 2)}
Result: ${typeof result === 'string' ? result : JSON.stringify(result, null, 2)}

Analyze this result and provide insights to the user.
  `;

  return {
    system: systemPrompt,
    user: userPrompt
  };
}

/**
 * Parse commands from AI response
 */
function parseCommandsFromAIResponse(response) {
  try {
    // Try to parse the response as JSON
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                      response.match(/```\n([\s\S]*?)\n```/) ||
                      response.match(/{[\s\S]*}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[0].replace(/```json\n|```\n|```/g, '');
      const parsed = JSON.parse(jsonStr);

      if (parsed.commands && Array.isArray(parsed.commands)) {
        return parsed.commands;
      }
    }

    // If JSON parsing fails, try to extract commands manually
    logger.warn('Failed to parse JSON from AI response, attempting manual extraction');

    // Simple extraction logic - this would need to be more robust in a real implementation
    const commands = [];
    const commandBlocks = response.split(/Command \d+:|Tool:|Tool Name:/i);

    for (let i = 1; i < commandBlocks.length; i++) {
      const block = commandBlocks[i];

      // Extract tool name
      const toolNameMatch = block.match(/Tool(?:\s+Name)?:\s*([^\n]+)/i) ||
                           block.match(/([a-zA-Z0-9_]+)(?:\s+with parameters)/i);

      // Extract parameters
      const paramsMatch = block.match(/Parameters:\s*({[^}]+})/i) ||
                         block.match(/with parameters\s*({[^}]+})/i);

      // Extract description
      const descMatch = block.match(/Description:\s*([^\n]+(?:\n[^\n]+)*)/i) ||
                       block.match(/This command will\s*([^\n]+(?:\n[^\n]+)*)/i);

      if (toolNameMatch) {
        const toolName = toolNameMatch[1].trim();
        let parameters = {};
        let description = descMatch ? descMatch[1].trim() : `Execute ${toolName}`;

        if (paramsMatch) {
          try {
            parameters = JSON.parse(paramsMatch[1]);
          } catch (e) {
            logger.error(`Failed to parse parameters: ${e.message}`);
          }
        }

        commands.push({
          command: `Execute ${toolName} with parameters ${JSON.stringify(parameters)}`,
          toolName,
          parameters,
          description
        });
      }
    }

    return commands.length > 0 ? commands : [
      {
        command: 'Echo user request',
        toolName: 'runShellCommand',
        parameters: { command: `echo "${response}"` },
        description: 'Echo the AI response as a fallback'
      }
    ];
  } catch (error) {
    logger.error(`Error parsing commands from AI response: ${error.message}`);

    // Return a fallback command
    return [
      {
        command: 'Echo user request',
        toolName: 'runShellCommand',
        parameters: { command: 'echo "Failed to parse AI response"' },
        description: 'Echo a failure message as a fallback'
      }
    ];
  }
}

/**
 * Parse analysis from AI response
 */
function parseAnalysisFromAIResponse(response) {
  try {
    // Try to parse the response as JSON
    const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/) ||
                      response.match(/```\n([\s\S]*?)\n```/) ||
                      response.match(/{[\s\S]*}/);

    if (jsonMatch) {
      const jsonStr = jsonMatch[0].replace(/```json\n|```\n|```/g, '');
      const parsed = JSON.parse(jsonStr);

      if (parsed.analysis) {
        return parsed;
      }
    }

    // If JSON parsing fails, return the raw response as the analysis
    return {
      analysis: response
    };
  } catch (error) {
    logger.error(`Error parsing analysis from AI response: ${error.message}`);

    // Return a fallback analysis
    return {
      analysis: 'Failed to parse AI response. Raw response: ' + response
    };
  }
}

module.exports = router;
