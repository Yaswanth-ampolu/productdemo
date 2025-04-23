import React, { useEffect, useState } from 'react';
import { getActiveOllamaModels, OllamaModel } from '../../services/ollamaService';
import { 
  Box, 
  Select, 
  Text,
  Flex,
  Tooltip,
  Badge,
  Spinner,
  Alert,
  AlertIcon
} from '@chakra-ui/react';
import { CpuChipIcon } from '@heroicons/react/24/outline';

interface ModelSelectorProps {
  onSelectModel: (modelId: string) => void;
  selectedModelId?: string;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({ 
  onSelectModel, 
  selectedModelId 
}) => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load models from API
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        const fetchedModels = await getActiveOllamaModels();
        setModels(fetchedModels);
        
        // If no model is selected yet and we have models, select the first one
        if (!selectedModelId && fetchedModels.length > 0) {
          onSelectModel(fetchedModels[0].id);
        }
        
        setError(null);
      } catch (err) {
        console.error('Failed to fetch models:', err);
        setError('Failed to load AI models. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, [onSelectModel, selectedModelId]);

  // When user selects a model from dropdown
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const modelId = e.target.value;
    onSelectModel(modelId);
    
    // Save to localStorage for persistence
    localStorage.setItem('selectedModelId', modelId);
  };

  // Get model details for display
  const getModelBadgeType = (modelName: string) => {
    const lowerName = modelName.toLowerCase();
    if (lowerName.includes('code') || lowerName.includes('starcoder')) {
      return { color: 'purple', text: 'Code' };
    } else if (lowerName.includes('mini') || lowerName.includes('tiny')) {
      return { color: 'green', text: 'Fast' };
    } else if (lowerName.includes('large') || lowerName.includes('34b') || lowerName.includes('70b')) {
      return { color: 'orange', text: 'Large' };
    }
    return { color: 'blue', text: 'General' };
  };

  if (loading) {
    return (
      <Flex align="center" justify="center" p={2}>
        <Spinner size="sm" mr={2} color="brand.primary" />
        <Text fontSize="sm" color="text.muted">Loading models...</Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Alert status="error" variant="subtle" size="sm" borderRadius="md">
        <AlertIcon />
        {error}
      </Alert>
    );
  }

  if (models.length === 0) {
    return (
      <Alert status="info" variant="subtle" size="sm" borderRadius="md">
        <AlertIcon />
        No AI models available. Please ask an administrator to configure models.
      </Alert>
    );
  }

  return (
    <Box mb={4}>
      <Flex align="center" mb={2}>
        <CpuChipIcon className="w-4 h-4 mr-2" />
        <Text fontSize="sm" fontWeight="medium" color="text.secondary">AI Model</Text>
      </Flex>
      
      <Select
        value={selectedModelId}
        onChange={handleModelChange}
        size="sm"
        variant="filled"
        icon={<CpuChipIcon className="w-4 h-4" />}
      >
        {models.map(model => (
          <option key={model.id} value={model.id}>
            {model.name}
            {/* Badge indicators added in option element but will render only when
                the model is displayed in the UI, not in the dropdown itself */}
          </option>
        ))}
      </Select>
      
      {/* Show selected model info */}
      {selectedModelId && (
        <Flex mt={2} alignItems="center">
          <Text fontSize="xs" color="text.muted" mr={2}>
            {models.find(m => m.id === selectedModelId)?.description || 'AI model'}
          </Text>
          {models.find(m => m.id === selectedModelId) && (
            <Badge 
              colorScheme={getModelBadgeType(models.find(m => m.id === selectedModelId)?.name || '').color}
              fontSize="xs"
              variant="subtle"
            >
              {getModelBadgeType(models.find(m => m.id === selectedModelId)?.name || '').text}
            </Badge>
          )}
        </Flex>
      )}
    </Box>
  );
};

export default ModelSelector; 