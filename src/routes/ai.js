const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const OllamaService = require('../services/ollamaService');

// Initialize the Ollama service
const ollamaService = new OllamaService();

// Load settings at startup
let serviceInitialized = false;
const initService = async () => {
  if (!serviceInitialized) {
    await ollamaService.initialize();
    serviceInitialized = true;
  }
};
initService();

/**
 * Generate MCP commands based on a user request
 * POST /api/ai/generate-command
 */
router.post('/generate-command', async (req, res) => {
  try {
    const { request, tools, mcpServer, modelId } = req.body;

    if (!request) {
      return res.status(400).json({ error: 'Request is required' });
    }

    logger.info(`Generating commands for request: ${request}`);

    // Create a prompt for the AI model
    const prompt = createCommandGenerationPrompt(request, tools, mcpServer);

    // Make sure service is initialized to get settings
    if (!serviceInitialized) {
      await initService();
    }
    
    // Get default model from service settings
    let defaultModel = '';
    try {
      if (ollamaService.settings && ollamaService.settings.default_model) {
        defaultModel = ollamaService.settings.default_model;
      }
    } catch (err) {
      logger.warn('Could not get default model from settings:', err);
    }

    try {
      // Use provided modelId, or service default, or environment variable, or lastly a fallback
      const selectedModel = modelId || defaultModel || process.env.DEFAULT_OLLAMA_MODEL || 'llama3';
      const aiResponse = await ollamaService.generateResponse(prompt, selectedModel);

    // Parse the AI response to extract commands
      const commands = parseCommandsFromResponse(aiResponse, tools);

    return res.json({ commands });
    } catch (aiError) {
      logger.error('Error with Ollama service:', aiError);
      
      // Fallback: Return empty commands array with explanation
      logger.info('Using fallback response for command generation');
      return res.json({ 
        commands: [],
        error: 'AI service unavailable. Please check Ollama configuration.'
      });
    }
  } catch (error) {
    logger.error('Error generating commands:', error);
    return res.status(500).json({ error: 'Failed to generate commands' });
  }
});

/**
 * Generate an AI greeting for MCP connection
 * POST /api/ai/generate-greeting
 */
router.post('/generate-greeting', async (req, res) => {
  try {
    const { mcpServer, tools, modelId } = req.body;
    
    // Create a prompt for the AI model
    const prompt = createGreetingPrompt(mcpServer, tools);
    
    // Make sure service is initialized to get settings
    if (!serviceInitialized) {
      await initService();
    }
    
    // Get default model from service settings
    let defaultModel = '';
    try {
      if (ollamaService.settings && ollamaService.settings.default_model) {
        defaultModel = ollamaService.settings.default_model;
      }
    } catch (err) {
      logger.warn('Could not get default model from settings:', err);
    }

    try {
      // Use provided modelId, or service default, or environment variable, or lastly a fallback
      const selectedModel = modelId || defaultModel || process.env.DEFAULT_OLLAMA_MODEL || 'llama3';
      const aiResponse = await ollamaService.generateResponse(prompt, selectedModel);
      
      return res.json({ greeting: aiResponse.trim() });
    } catch (aiError) {
      logger.error('Error with Ollama service:', aiError);
      
      // Fallback: Return a simple greeting
      const fallbackGreeting = `Hello! I'm your MCP AI Agent assistant, connected to ${mcpServer?.nickname || 'the MCP server'} at ${mcpServer?.host}:${mcpServer?.port}. I can help you interact with the server using ${tools?.length || 'various'} available tools. What would you like to do today?`;
      
      logger.info('Using fallback greeting');
      return res.json({ greeting: fallbackGreeting });
    }
  } catch (error) {
    logger.error('Error generating greeting:', error);
    return res.status(500).json({ error: 'Failed to generate greeting' });
  }
});

/**
 * Analyze a command result and generate follow-up commands
 * POST /api/ai/analyze-result
 */
router.post('/analyze-result', async (req, res) => {
  try {
    const { result, originalRequest, toolName, parameters, modelId } = req.body;

    if (!result) {
      return res.status(400).json({ error: 'Result is required' });
    }

    logger.info(`Analyzing result for tool: ${toolName}`);

    // Create a prompt for the AI model
    const prompt = createResultAnalysisPrompt(result, originalRequest, toolName, parameters);

    // Make sure service is initialized to get settings
    if (!serviceInitialized) {
      await initService();
    }
    
    // Get default model from service settings
    let defaultModel = '';
    try {
      if (ollamaService.settings && ollamaService.settings.default_model) {
        defaultModel = ollamaService.settings.default_model;
      }
    } catch (err) {
      logger.warn('Could not get default model from settings:', err);
    }

    try {
      // Use provided modelId, or service default, or environment variable, or lastly a fallback
      const selectedModel = modelId || defaultModel || process.env.DEFAULT_OLLAMA_MODEL || 'llama3';
      const aiResponse = await ollamaService.generateResponse(prompt, selectedModel);

    // Parse the AI response to extract analysis and follow-up commands
      const analysisResult = parseAnalysisFromResponse(aiResponse);

      return res.json(analysisResult);
    } catch (aiError) {
      logger.error('Error with Ollama service:', aiError);
      
      // Fallback: Return a simple analysis with no follow-up commands
      const fallbackAnalysis = {
        analysis: `Command ${toolName} completed. The AI analysis service is currently unavailable, but you can continue using MCP commands directly.`,
        followUpCommands: []
      };
      
      logger.info('Using fallback analysis');
      return res.json(fallbackAnalysis);
    }
  } catch (error) {
    logger.error('Error analyzing result:', error);
    return res.status(500).json({ error: 'Failed to analyze result' });
  }
});

/**
 * Create a prompt for command generation
 */
function createCommandGenerationPrompt(request, tools, mcpServer) {
  // Create a description of available tools
  const toolsDescription = tools.map(tool => {
    const parametersDesc = Object.entries(tool.parameters || {})
      .map(([name, schema]) => `    - ${name}: ${schema.description || 'No description'} (${schema.type || 'any'})${schema.required ? ' (required)' : ''}`)
      .join('\n');

    return `
  - ${tool.name}: ${tool.description}
    Parameters:
${parametersDesc}`;
  }).join('\n');

  // Build the prompt
  return `
You are an AI assistant helping to generate MCP commands for a user request. 
You have access to an MCP server at ${mcpServer?.host}:${mcpServer?.port} with clientId ${mcpServer?.clientId}.

The user has requested: "${request}"

Available tools:
${toolsDescription}

Your task is to determine the appropriate MCP command(s) to fulfill the user's request.
For each command, provide:
1. The tool name
2. Parameters with appropriate values
3. A brief description of what the command will do

Format your response as a JSON array with the following structure:
[
  {
    "toolName": "tool_name",
    "parameters": {
      "param1": "value1",
      "param2": "value2"
    },
    "command": "A natural language description of the command",
    "description": "What this command will accomplish"
  }
]

If the user's request cannot be fulfilled with the available tools, explain why and suggest alternatives.
`;
}

/**
 * Create a prompt for generating a greeting
 */
function createGreetingPrompt(mcpServer, tools) {
  // Count tools by category if possible
  let toolCategories = {};
  let toolCount = 0;
  
  if (tools && Array.isArray(tools)) {
    toolCount = tools.length;
    
    // Try to categorize tools
    tools.forEach(tool => {
      // Determine category based on name prefix or description
      let category = 'Other';
      
      if (tool.name.startsWith('get_') || tool.name.includes('fetch') || tool.name.includes('list')) {
        category = 'Data Retrieval';
      } else if (tool.name.startsWith('set_') || tool.name.includes('update') || tool.name.includes('modify')) {
        category = 'Data Modification';
      } else if (tool.name.includes('generate') || tool.name.includes('create')) {
        category = 'Generation';
      } else if (tool.name.includes('search') || tool.name.includes('find')) {
        category = 'Search';
      }
      
      toolCategories[category] = (toolCategories[category] || 0) + 1;
    });
  }
  
  // Convert categories to description
  const categoryDescription = Object.entries(toolCategories)
    .map(([category, count]) => `- ${category}: ${count} tools`)
    .join('\n');
  
  // Build the prompt
  return `
You are an AI assistant for an MCP (Multi-Computing Platform) Agent. 
You need to generate a friendly and informative greeting for a user who has just connected to an MCP server.

Connection details:
- Server: ${mcpServer?.nickname || 'MCP server'} at ${mcpServer?.host}:${mcpServer?.port}
- Number of available tools: ${toolCount}
${categoryDescription ? `\nTool categories:\n${categoryDescription}` : ''}

Your greeting should:
1. Be concise (1-2 paragraphs maximum)
2. Welcome the user to the MCP Agent
3. Briefly mention the capabilities available
4. Invite the user to make a request

Response tone should be helpful, professional but friendly. Avoid being overly technical.
`;
}

/**
 * Create a prompt for result analysis
 */
function createResultAnalysisPrompt(result, originalRequest, toolName, parameters) {
  // Convert result to string representation for the prompt
  let resultString = '';
  try {
    if (typeof result === 'object') {
      resultString = JSON.stringify(result, null, 2);
    } else {
      resultString = String(result);
    }
  } catch (error) {
    resultString = `Error serializing result: ${error.message}`;
  }

  // Convert parameters to string
  const paramsString = JSON.stringify(parameters || {}, null, 2);

  // Build the prompt
  return `
You are an AI assistant helping to analyze MCP command results and determine follow-up actions.

ORIGINAL REQUEST: "${originalRequest}"

EXECUTED COMMAND:
Tool: ${toolName}
Parameters: ${paramsString}

COMMAND RESULT:
${resultString}

Analyze the result and determine:
1. What information was obtained from the result
2. Whether the original request has been fully addressed
3. What follow-up actions should be taken, if any

Your task is to:
1. Provide a concise analysis of the result (1-2 paragraphs)
2. Determine if any follow-up commands are needed
3. If follow-up commands are needed, specify them

Format your response as JSON with the following structure:
{
  "analysis": "Your analysis of the result and what it means",
  "isComplete": true/false, // Whether the original request is fully addressed
  "followUpCommands": [ // Only include if follow-up commands are needed
    {
      "toolName": "tool_name",
      "parameters": {
        "param1": "value1",
        "param2": "value2"
      },
      "command": "A natural language description of the command",
      "description": "What this command will accomplish"
    }
  ]
}

If no follow-up commands are needed, set "isComplete" to true and omit the "followUpCommands" field.
`;
}

/**
 * Parse the AI response to extract commands
 */
function parseCommandsFromResponse(aiResponse, availableTools) {
  try {
    // Try to extract JSON array from the response
    const jsonMatches = aiResponse.match(/\[[\s\S]*\]/);
    if (jsonMatches) {
      const jsonString = jsonMatches[0];
      const commands = JSON.parse(jsonString);
      
      // Validate commands against available tools
      return commands.filter(cmd => {
        const isValidTool = availableTools.some(tool => tool.name === cmd.toolName);
        return isValidTool && cmd.parameters;
      });
          }
    
    // If no JSON array found, return empty array
    return [];
  } catch (error) {
    logger.error('Error parsing commands from response:', error);
    return [];
  }
}

/**
 * Parse the AI response to extract analysis and follow-up commands
 */
function parseAnalysisFromResponse(aiResponse) {
  try {
    // Try to extract JSON object from the response
    const jsonMatches = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatches) {
      const jsonString = jsonMatches[0];
      const analysis = JSON.parse(jsonString);
      
      // Ensure the analysis has the required fields
      if (!analysis.analysis) {
        analysis.analysis = "Result analyzed, but no specific insights were provided.";
      }
      
      if (analysis.isComplete === undefined) {
        analysis.isComplete = true;
      }
      
      return analysis;
    }

    // If no JSON object found, return a default analysis
    return {
      analysis: "Failed to parse analysis from AI response. The result was processed, but no structured analysis is available.",
      isComplete: true
    };
  } catch (error) {
    logger.error('Error parsing analysis from response:', error);
    return {
      analysis: `Error analyzing result: ${error.message}`,
      isComplete: true
    };
  }
}

module.exports = router;
