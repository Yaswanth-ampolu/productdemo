import React from 'react';
import { useMCPAgent } from '../../contexts/MCPAgentContext';
import MCPCommandApproval from './MCPCommandApproval';
import MCPCommandResult from './MCPCommandResult';

const MCPAgentCommands: React.FC = () => {
  const { pendingCommands, commandResults, isAgentEnabled } = useMCPAgent();

  // Don't render anything if the agent is not enabled
  if (!isAgentEnabled) {
    return null;
  }

  return (
    <div className="mcp-agent-commands">
      {/* Display pending commands */}
      {pendingCommands.length > 0 && (
        <div className="my-4">
          {pendingCommands.map(command => (
            <MCPCommandApproval
              key={command.id}
              commandId={command.id}
              command={command.command}
              toolName={command.toolName}
              parameters={command.parameters}
              description={command.description}
            />
          ))}
        </div>
      )}

      {/* Display command results */}
      {commandResults.length > 0 && (
        <div className="my-4">
          {commandResults.map(result => (
            <MCPCommandResult
              key={result.id}
              resultId={result.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MCPAgentCommands;
