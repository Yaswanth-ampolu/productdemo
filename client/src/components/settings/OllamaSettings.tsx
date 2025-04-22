import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Grid,
  Input,
  Text,
  useToast,
  Spinner,
  Flex,
  Switch,
  VStack,
  HStack,
  Badge,
  Tooltip,
  Heading,
  Alert,
  AlertIcon,
  AlertDescription,
  Divider,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Select,
  Tag,
  TagLabel,
  TagLeftIcon,
  Icon,
  keyframes,
  Kbd,
  useColorModeValue,
  IconButton,
  Checkbox,
} from '@chakra-ui/react';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer
} from '@chakra-ui/table';
import { Card, CardBody, CardHeader, CardFooter } from '@chakra-ui/card';
import { 
  CheckCircleIcon, 
  WarningIcon, 
  RepeatIcon, 
  RepeatClockIcon,
  SettingsIcon,
  LinkIcon,
  StarIcon,
  ArrowForwardIcon,
  CloseIcon,
  ChevronRightIcon,
  InfoIcon
} from '@chakra-ui/icons';
import axios from 'axios';
import { syncOllamaModels, SyncResult, getOllamaSettings, getOllamaModelsFromDB, saveOllamaSettings, testOllamaConnection, getAvailableOllamaModels, toggleOllamaModelStatus, OllamaSettings as ServiceOllamaSettings, OllamaModel } from '../../services/ollamaService';

// Storage key for caching settings
const SETTINGS_CACHE_KEY = 'ollama_settings_cache';
const MODELS_CACHE_KEY = 'ollama_models_cache';
const AVAILABLE_MODELS_CACHE_KEY = 'ollama_available_models_cache';
const SELECTED_MODELS_CACHE_KEY = 'ollama_selected_models_cache';

// Animation keyframes
const pulse = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
`;

interface OllamaSettingsProps {
  isAdmin: boolean;
}

// Use OllamaSettings type from the service
type Settings = ServiceOllamaSettings;

const OllamaSettings: React.FC<OllamaSettingsProps> = ({ isAdmin }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    // Try to load from cache on initial render
    const cachedSettings = localStorage.getItem(SETTINGS_CACHE_KEY);
    return cachedSettings ? JSON.parse(cachedSettings) : {
      host: 'localhost',
      port: 11434,
      default_model: ''
    };
  });

  const [models, setModels] = useState<OllamaModel[]>(() => {
    // Try to load models from cache on initial render
    const cachedModels = localStorage.getItem(MODELS_CACHE_KEY);
    return cachedModels ? JSON.parse(cachedModels) : [];
  });

  const [availableModels, setAvailableModels] = useState<OllamaModel[]>(() => {
    // Try to load available models from cache on initial render
    const cachedAvailableModels = localStorage.getItem(AVAILABLE_MODELS_CACHE_KEY);
    return cachedAvailableModels ? JSON.parse(cachedAvailableModels) : [];
  });

  const [selectedModels, setSelectedModels] = useState<string[]>(() => {
    // Try to load selected models from cache on initial render
    const cachedSelectedModels = localStorage.getItem(SELECTED_MODELS_CACHE_KEY);
    return cachedSelectedModels ? JSON.parse(cachedSelectedModels) : [];
  });

  const [saveLoading, setSaveLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'error' | 'testing'>('unknown');
  const [lastAction, setLastAction] = useState<string>('');
  const [lastError, setLastError] = useState<string>('');
  const toast = useToast();
  const retryModal = useDisclosure();
  const [retryOperation, setRetryOperation] = useState<() => Promise<void>>(() => async () => {});

  // Load settings and models on component mount and when admin status changes
  useEffect(() => {
    if (isAdmin) {
      loadSettings();
      loadModels();
    }
  }, [isAdmin]);

  // Cache settings whenever they change
  useEffect(() => {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
  }, [settings]);
  
  // Cache models whenever they change
  useEffect(() => {
    localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify(models));
  }, [models]);

  // Cache available models whenever they change
  useEffect(() => {
    localStorage.setItem(AVAILABLE_MODELS_CACHE_KEY, JSON.stringify(availableModels));
  }, [availableModels]);

  // Cache selected models whenever they change
  useEffect(() => {
    localStorage.setItem(SELECTED_MODELS_CACHE_KEY, JSON.stringify(selectedModels));
  }, [selectedModels]);

  // Debounced load settings to prevent excessive API calls
  const loadSettings = useCallback(async () => {
    // Only make API call if we don't have settings or if they're stale
    try {
      setLastAction('Loading settings...');
      const result = await getOllamaSettings();
      
      if (result && typeof result === 'object') {
        setSettings(result);
        setLastAction('Settings loaded successfully');
      } else {
        setLastAction('Failed to load settings: Invalid response format');
        setLastError('Could not load Ollama settings');
        showToast({
          title: 'Error loading settings',
          description: 'Could not load Ollama settings',
          status: 'error'
        });
      }
    } catch (error: any) {
      console.error('Error loading Ollama settings:', error);
      setLastAction('Failed to load settings');
      setLastError(error.response?.data?.message || error.message || 'Failed to load Ollama settings');
      
      showToast({
        title: 'Error loading settings',
        description: error.response?.data?.message || error.message || 'Failed to load Ollama settings',
        status: 'error'
      });
      
      // Setup retry operation
      setRetryOperation(() => loadSettings);
    }
  }, []);

  const loadModels = useCallback(async () => {
    try {
      setModelsLoading(true);
      setLastAction('Loading models from database...');
      
      const models = await getOllamaModelsFromDB();
      
      if (Array.isArray(models)) {
        setModels(models || []);
        setLastAction(`Loaded ${models.length || 0} models from database`);
      } else {
        setLastAction('Failed to load models: Invalid response format');
        setLastError('Could not load AI models from database');
        showToast({
          title: 'Error loading models',
          description: 'Could not load AI models from database',
          status: 'error'
        });
        
        // Setup retry operation
        setRetryOperation(() => loadModels);
      }
    } catch (error: any) {
      console.error('Error loading AI models:', error);
      setLastAction('Failed to load models from database');
      setLastError(error.response?.data?.message || error.message || 'Failed to load AI models from database');
      
      showToast({
        title: 'Error loading models',
        description: error.response?.data?.message || error.message || 'Failed to load AI models from database',
        status: 'error'
      });
      
      // Setup retry operation
      setRetryOperation(() => loadModels);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: name === 'port' ? parseInt(value, 10) || 0 : value
    }));
  };

  const saveSettings = async () => {
    try {
      setSaveLoading(true);
      setLastAction('Saving settings...');
      setLastError('');
      
      const result = await saveOllamaSettings(settings);
      
      if (result && typeof result === 'object') {
        setLastAction('Settings saved successfully');
        setConnectionStatus('unknown'); // Reset connection status after changing settings
        showToast({
          title: 'Settings saved',
          description: 'Ollama connection settings have been updated',
          status: 'success'
        });
        
        // Update cached settings
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
        
        // Test connection after saving settings
        await testConnection();
      } else {
        setLastAction('Failed to save settings: Invalid response format');
        setLastError('There was a problem saving your settings');
        showToast({
          title: 'Error saving settings',
          description: 'There was a problem saving your settings',
          status: 'error'
        });
        
        // Setup retry operation
        setRetryOperation(() => saveSettings);
        retryModal.onOpen();
      }
    } catch (error: any) {
      console.error('Error saving Ollama settings:', error);
      setLastAction('Failed to save settings');
      setLastError(error.response?.data?.message || error.message || 'Failed to save Ollama connection settings');
      
      showToast({
        title: 'Error saving settings',
        description: error.response?.data?.message || error.message || 'Failed to save Ollama connection settings',
        status: 'error'
      });
      
      // Setup retry operation
      setRetryOperation(() => saveSettings);
      retryModal.onOpen();
    } finally {
      setSaveLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setTestLoading(true);
      setConnectionStatus('testing');
      setLastAction('Testing connection to Ollama server...');
      setLastError('');
      
      const result = await testOllamaConnection(settings.host, settings.port);
      
      if (result.success) {
        setConnectionStatus('success');
        setLastAction(`Connection successful! Ollama ${result.version || 'server'} responded in ${result.responseTime || '?'}ms`);
        showToast({
          title: 'Connection successful',
          description: `Connected to Ollama ${result.version || 'server'} in ${result.responseTime || '?'}ms`,
          status: 'success'
        });
        
        // Auto-fetch models on successful connection
        fetchAvailableModels();
      } else {
        setConnectionStatus('error');
        setLastAction(`Connection failed: ${result.message || result.error || 'Unknown error'}`);
        setLastError(result.message || result.error || 'Failed to connect to Ollama server');
        showToast({
          title: 'Connection failed',
          description: result.message || result.error || 'Failed to connect to Ollama server',
          status: 'error'
        });
      }
    } catch (error: any) {
      console.error('Error testing Ollama connection:', error);
      setConnectionStatus('error');
      setLastAction('Connection test failed');
      setLastError(error.response?.data?.message || error.message || 'Failed to connect to Ollama server');
      
      showToast({
        title: 'Connection failed',
        description: error.response?.data?.message || error.message || 'Failed to connect to Ollama server',
        status: 'error'
      });
    } finally {
      setTestLoading(false);
    }
  };

  // Helper function for showing toast notifications
  const showToast = ({ title, description, status }: { title: string, description: string, status: 'success' | 'error' | 'info' | 'warning' }) => {
    toast({
      title,
      description,
      status,
      duration: 3000,
      isClosable: true,
    });
  };

  const handleModelSelection = (modelId: string) => {
    setSelectedModels(prev => {
      if (prev.includes(modelId)) {
        return prev.filter(id => id !== modelId);
      } else {
        return [...prev, modelId];
      }
    });
  };

  const fetchAvailableModels = async () => {
    try {
      setFetchLoading(true);
      setLastAction('Fetching available models from Ollama server...');
      setLastError('');
      
      const models = await getAvailableOllamaModels();
      
      if (Array.isArray(models)) {
        setAvailableModels(models);
        
        // If no models are selected yet, auto-select all models
        if (selectedModels.length === 0) {
          setSelectedModels(models.map(model => model.ollama_model_id || model.name));
        }
        
        setLastAction(`Found ${models.length} models on Ollama server`);
        showToast({
          title: 'Models fetched',
          description: `Found ${models.length} models on the Ollama server`,
          status: 'success'
        });
      } else {
        setLastAction('Failed to fetch models: Invalid response format');
        setLastError('Could not fetch models from Ollama server');
        showToast({
          title: 'Fetch failed',
          description: 'Could not fetch models from Ollama server',
          status: 'error'
        });
        
        // Setup retry operation
        setRetryOperation(() => fetchAvailableModels);
        retryModal.onOpen();
      }
    } catch (error: any) {
      console.error('Error fetching available models:', error);
      setLastAction('Failed to fetch models from Ollama server');
      setLastError(error.response?.data?.message || error.message || 'Error fetching models from Ollama server');
      
      showToast({
        title: 'Fetch failed',
        description: error.response?.data?.message || error.message || 'Error fetching models from Ollama server',
        status: 'error'
      });
      
      // Setup retry operation
      setRetryOperation(() => fetchAvailableModels);
      retryModal.onOpen();
    } finally {
      setFetchLoading(false);
    }
  };

  // Helper function to format model size
  const formatModelSize = (sizeInBytes: number): string => {
    if (!sizeInBytes) return 'Unknown';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(sizeInBytes) / Math.log(1024));
    return `${(sizeInBytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const syncModels = async () => {
    try {
      setSyncLoading(true);
      setLastAction('Saving model selections to database...');
      setLastError('');
      
      // Pass selected models to sync and set active status to true
      // Non-selected models will be set to inactive (is_active=false)
      const result = await syncOllamaModels(selectedModels);
      
      if (result && typeof result === 'object') {
        const totalSynced = (result.added || 0) + (result.updated || 0);
        const inactivatedCount = result.inactivated || 0;
        
        setLastAction(`Models saved successfully: ${totalSynced} models updated (${result.added || 0} added, ${result.updated || 0} updated, ${inactivatedCount} deactivated)`);
        
        showToast({
          title: 'Models saved',
          description: `Successfully saved ${selectedModels.length} models as active and deactivated ${inactivatedCount} models`,
          status: 'success'
        });
        
        // Reload models from the database to show updates
        await loadModels();
      } else {
        setLastAction('Failed to save models: Invalid response format');
        setLastError('Failed to save models to database - unexpected response format');
        
        showToast({
          title: 'Save failed',
          description: 'Failed to save models to database - unexpected response format',
          status: 'error'
        });
        
        // Setup retry operation
        setRetryOperation(() => syncModels);
        retryModal.onOpen();
      }
    } catch (error: any) {
      console.error('Error saving models:', error);
      setLastAction('Failed to save models to database');
      setLastError(error.response?.data?.message || error.message || 'Error saving models to database');
      
      showToast({
        title: 'Save failed',
        description: error.response?.data?.message || error.message || 'Error saving models to database',
        status: 'error'
      });
      
      // Setup retry operation
      setRetryOperation(() => syncModels);
      retryModal.onOpen();
    } finally {
      setSyncLoading(false);
    }
  };

  const toggleModelStatus = async (modelId: string, isActive: boolean) => {
    try {
      setLastAction(`${isActive ? 'Activating' : 'Deactivating'} model ${modelId}...`);
      setLastError('');
      
      const model = await toggleOllamaModelStatus(modelId, isActive);
      
      if (model && typeof model === 'object') {
        setLastAction(`Model ${modelId} ${isActive ? 'activated' : 'deactivated'} successfully`);
        showToast({
          title: `Model ${isActive ? 'activated' : 'deactivated'}`,
          description: `The model has been ${isActive ? 'activated' : 'deactivated'} successfully`,
          status: 'success'
        });
        
        // Update local state to reflect the change
        const updatedModels = models.map(m => 
          m.id === modelId ? { ...m, is_active: isActive } : m
        );
        setModels(updatedModels);
        
        // Update cache
        localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify(updatedModels));
      } else {
        setLastAction(`Failed to ${isActive ? 'activate' : 'deactivate'} model: Invalid response format`);
        setLastError(`Could not ${isActive ? 'activate' : 'deactivate'} the model`);
        showToast({
          title: 'Status update failed',
          description: `Could not ${isActive ? 'activate' : 'deactivate'} the model`,
          status: 'error'
        });
        
        // Setup retry operation for the specific model toggle
        setRetryOperation(() => () => toggleModelStatus(modelId, isActive));
        retryModal.onOpen();
      }
    } catch (error: any) {
      console.error(`Error ${isActive ? 'activating' : 'deactivating'} model:`, error);
      setLastAction(`Failed to ${isActive ? 'activate' : 'deactivate'} model`);
      setLastError(error.response?.data?.message || error.message || `Error ${isActive ? 'activating' : 'deactivating'} the model`);
      
      showToast({
        title: 'Status update failed',
        description: error.response?.data?.message || error.message || `Error ${isActive ? 'activating' : 'deactivating'} the model`,
        status: 'error'
      });
      
      // Setup retry operation for the specific model toggle
      setRetryOperation(() => () => toggleModelStatus(modelId, isActive));
      retryModal.onOpen();
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryOperation();
      retryModal.onClose();
    } catch (error) {
      console.error('Retry failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const renderConnectionStatusIcon = () => {
    if (connectionStatus === 'success') {
      return <CheckCircleIcon color="green.400" />;
    } else if (connectionStatus === 'error') {
      return <WarningIcon color="red.400" />;
    } else if (connectionStatus === 'testing') {
      return <Spinner size="sm" color="blue.400" />;
    } else {
      return <RepeatIcon color="gray.400" />;
    }
  };

  // Function to handle setting default model
  const handleDefaultModelChange = (modelId: string) => {
    setSettings(prev => ({
      ...prev,
      default_model: modelId
    }));
  };

  if (!isAdmin) {
    return (
      <Box px={0} py={2} width="100%">
        <Alert status="warning" borderRadius="md">
          <AlertIcon />
          <AlertDescription>You need administrator privileges to access Ollama settings.</AlertDescription>
        </Alert>
      </Box>
    );
  }

  return (
    <Box width="100%" px={0} py={0}>
      <VStack gap={6} align="stretch">
        <Card 
          variant="elevated" 
          boxShadow="lg" 
          borderRadius="xl" 
          overflow="hidden"
          borderWidth="1px"
          borderColor="var(--color-border)"
          transition="all 0.2s"
          _hover={{ boxShadow: "xl" }}
        >
          <CardHeader 
            bg="var(--color-surface-light)" 
            py={4} 
            borderBottomWidth="1px" 
            borderColor="var(--color-border)"
            display="flex"
            alignItems="center"
          >
            <Icon as={SettingsIcon} mr={2} color="var(--color-primary)" />
            <Heading size="md" color="var(--color-text)">Ollama API Connection</Heading>
          </CardHeader>
          
          <CardBody p={6} bg="var(--color-surface)">
            <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={6}>
              <FormControl>
                <FormLabel 
                  fontWeight="medium" 
                  color="var(--color-text-secondary)"
                  display="flex"
                  alignItems="center"
                >
                  <Icon as={LinkIcon} mr={2} boxSize={4} />
                  Host
                </FormLabel>
                <Input
                  name="host"
                  value={settings.host}
                  onChange={handleInputChange}
                  placeholder="localhost"
                  bg="var(--color-surface-dark)"
                  borderColor="var(--color-border)"
                  _hover={{ borderColor: "var(--color-primary)" }}
                  _focus={{ borderColor: "var(--color-primary)", boxShadow: "0 0 0 1px var(--color-primary)" }}
                  color="var(--color-text)"
                  size="md"
                  fontFamily="mono"
                  borderRadius="md"
                  transition="all 0.2s"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel 
                  fontWeight="medium" 
                  color="var(--color-text-secondary)"
                  display="flex"
                  alignItems="center"
                >
                  <Icon as={RepeatIcon} mr={2} boxSize={4} />
                  Port
                </FormLabel>
                <Input
                  name="port"
                  type="number"
                  value={settings.port}
                  onChange={handleInputChange}
                  placeholder="11434"
                  bg="var(--color-surface-dark)"
                  borderColor="var(--color-border)"
                  _hover={{ borderColor: "var(--color-primary)" }}
                  _focus={{ borderColor: "var(--color-primary)", boxShadow: "0 0 0 1px var(--color-primary)" }}
                  color="var(--color-text)"
                  size="md"
                  fontFamily="mono"
                  borderRadius="md"
                  transition="all 0.2s"
                />
              </FormControl>
              
              <FormControl gridColumn={{ md: "span 2" }}>
                <FormLabel 
                  fontWeight="medium" 
                  color="var(--color-text-secondary)"
                  display="flex"
                  alignItems="center"
                >
                  <Icon as={StarIcon} mr={2} boxSize={4} />
                  Default Model
                </FormLabel>
                {models.length > 0 ? (
                  <Select 
                    name="default_model"
                    value={settings.default_model}
                    onChange={(e) => handleDefaultModelChange(e.target.value)}
                    placeholder="Select a default model"
                    bg="var(--color-surface-dark)"
                    borderColor="var(--color-border)"
                    _hover={{ borderColor: "var(--color-primary)" }}
                    _focus={{ borderColor: "var(--color-primary)", boxShadow: "0 0 0 1px var(--color-primary)" }}
                    color="var(--color-text)"
                    icon={<ChevronRightIcon />}
                    borderRadius="md"
                    transition="all 0.2s"
                  >
                    {models.filter(model => model.is_active).map(model => (
                      <option key={model.ollama_model_id} value={model.ollama_model_id}>
                        {model.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Flex direction="column">
                    <Input
                      name="default_model"
                      value={settings.default_model}
                      onChange={handleInputChange}
                      placeholder="Sync models first to select a default model"
                      bg="var(--color-surface-dark)"
                      borderColor="var(--color-border)"
                      _hover={{ borderColor: "var(--color-primary)" }}
                      _focus={{ borderColor: "var(--color-primary)", boxShadow: "0 0 0 1px var(--color-primary)" }}
                      color="var(--color-text)"
                      borderRadius="md"
                      isDisabled={true}
                      transition="all 0.2s"
                    />
                    <Text mt={2} fontSize="sm" color="var(--color-text-muted)">
                      <Box 
                        as="span" 
                        display="inline-block" 
                        w="6px" 
                        h="6px" 
                        borderRadius="full" 
                        bg="orange.300" 
                        mr={2}
                        verticalAlign="middle"
                      />
                      Sync models to enable selection
                    </Text>
                  </Flex>
                )}
              </FormControl>
            </Grid>
            
            <Flex 
              direction="column" 
              gap={4} 
              mt={8}
              borderTop="1px solid var(--color-border)"
              pt={6}
            >
              <HStack 
                gap={4} 
                flexWrap="wrap"
                justifyContent="space-between"
              >
                <Button
                  bg="var(--color-primary)"
                  color="white"
                  onClick={saveSettings}
                  isLoading={saveLoading}
                  loadingText="Saving"
                  leftIcon={saveLoading ? undefined : <CheckCircleIcon />}
                  _hover={{ 
                    bg: 'var(--color-primary-dark)', 
                    transform: "translateY(-1px)",
                    boxShadow: "md"
                  }}
                  size="md"
                  borderRadius="lg"
                  px={6}
                  fontWeight="medium"
                  transition="all 0.2s"
                >
                  Save Settings
                </Button>
                
                <Button
                  bg={connectionStatus === 'success' ? 'green.600' : 
                      connectionStatus === 'error' ? 'red.600' : 
                      connectionStatus === 'testing' ? 'blue.600' : 'gray.600'}
                  color="white"
                  onClick={testConnection}
                  isLoading={testLoading}
                  loadingText="Testing"
                  leftIcon={renderConnectionStatusIcon()}
                  _hover={{ 
                    bg: connectionStatus === 'success' ? 'green.700' : 
                        connectionStatus === 'error' ? 'red.700' : 
                        connectionStatus === 'testing' ? 'blue.700' : 'gray.700',
                  }}
                  size="md"
                  borderRadius="lg"
                  px={6}
                  fontWeight="medium"
                  transition="all 0.2s"
                >
                  {connectionStatus === 'success' ? 'Connection Successful' : 
                   connectionStatus === 'error' ? 'Connection Failed' : 
                   connectionStatus === 'testing' ? 'Testing Connection...' : 'Test Connection'}
                </Button>
              </HStack>
            </Flex>
          </CardBody>
        </Card>
        
        <Card 
          variant="elevated" 
          boxShadow="lg" 
          borderRadius="xl" 
          overflow="hidden"
          borderWidth="1px"
          borderColor="var(--color-border)"
          transition="all 0.2s"
          _hover={{ boxShadow: "xl" }}
          mt={6}
        >
          <CardHeader 
            bg="var(--color-surface-light)" 
            py={4} 
            borderBottomWidth="1px" 
            borderColor="var(--color-border)"
            display="flex"
            alignItems="center"
          >
            <Icon as={RepeatIcon} mr={2} color="var(--color-primary)" />
            <Heading size="md" color="var(--color-text)">Model Management</Heading>
          </CardHeader>
          
          <CardBody p={5} bg="var(--color-surface)">
            <Box 
              p={4} 
              bg="var(--color-surface-dark)"
              borderRadius="md"
              borderWidth="1px"
              borderColor="var(--color-border)"
              mb={6}
            >
              <Flex justify="space-between" align="center" mb={3}>
                <Flex align="center">
                  <Box 
                    as="span"
                    bg="var(--color-primary)"
                    color="white"
                    fontWeight="bold"
                    w="24px"
                    h="24px"
                    borderRadius="full"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    mr={3}
                    fontSize="sm"
                  >
                    1
                  </Box>
                  <Text fontWeight="medium" color="var(--color-text)">Fetch Available Models</Text>
                </Flex>
                
                <Button
                  bg="var(--color-primary)"
                  color="white"
                  onClick={fetchAvailableModels}
                  isLoading={fetchLoading}
                  loadingText="Fetching"
                  leftIcon={<RepeatIcon />}
                  _hover={{ 
                    bg: 'var(--color-primary-dark)', 
                    transform: "translateY(-1px)",
                    boxShadow: "md"
                  }}
                  size="md"
                  borderRadius="lg"
                  fontWeight="medium"
                  transition="all 0.2s"
                >
                  Fetch Models
                </Button>
              </Flex>
              
              <Text fontSize="sm" color="var(--color-text-muted)" ml={10}>
                Retrieve all available models from your Ollama server
              </Text>
            </Box>
            
            {availableModels.length > 0 && (
              <Box 
                p={4} 
                bg="var(--color-surface-dark)"
                borderRadius="md"
                borderWidth="1px"
                borderColor="var(--color-border)"
                mb={6}
              >
                <Flex justify="space-between" align="center" mb={3}>
                  <Flex align="center">
                    <Box 
                      as="span"
                      bg="var(--color-primary)"
                      color="white"
                      fontWeight="bold"
                      w="24px"
                      h="24px"
                      borderRadius="full"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      mr={3}
                      fontSize="sm"
                    >
                      2
                    </Box>
                    <Text fontWeight="medium" color="var(--color-text)">Select Models ({selectedModels.length} of {availableModels.length} selected)</Text>
                  </Flex>
                  
                  <Button
                    size="sm"
                    onClick={() => setSelectedModels(availableModels.map(m => m.ollama_model_id || m.name))}
                    variant="outline"
                  >
                    Select All
                  </Button>
                </Flex>
                
                <Text fontSize="sm" color="var(--color-text-muted)" ml={10} mb={4}>
                  Choose which models to make available in your application
                </Text>
                
                <Grid 
                  templateColumns={{ 
                    base: "1fr", 
                    md: "repeat(2, 1fr)", 
                    lg: "repeat(3, 1fr)" 
                  }}
                  gap={4}
                  maxH={{ base: "300px", md: "240px" }}
                  overflowY="auto"
                  ml={10}
                  pr={2}
                  css={{
                    '&::-webkit-scrollbar': {
                      width: '4px',
                    },
                    '&::-webkit-scrollbar-track': {
                      width: '6px',
                      background: 'var(--color-surface-dark)'
                    },
                    '&::-webkit-scrollbar-thumb': {
                      background: 'var(--color-primary)',
                      borderRadius: '24px',
                    },
                  }}
                >
                  {availableModels.map((model: any, index: number) => (
                    <Flex 
                      key={index}
                      p={3}
                      borderWidth="1px"
                      borderRadius="lg"
                      borderColor={selectedModels.includes(model.ollama_model_id || model.name) ? "var(--color-primary)" : "var(--color-border)"}
                      bg={selectedModels.includes(model.ollama_model_id || model.name) ? "var(--color-surface-light)" : "var(--color-surface-dark)"}
                      transition="all 0.2s"
                      cursor="pointer"
                      onClick={() => handleModelSelection(model.ollama_model_id || model.name)}
                      align="center"
                    >
                      <Checkbox
                        isChecked={selectedModels.includes(model.ollama_model_id || model.name)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleModelSelection(model.ollama_model_id || model.name);
                        }}
                        colorScheme="green"
                        size="lg"
                        mr={3}
                      />
                      
                      <Box flex="1">
                        <Text 
                          fontSize="sm" 
                          fontWeight="bold" 
                          color="var(--color-text)"
                        >
                          {model.name}
                        </Text>
                        
                        <Flex mt={1} gap={2}>
                          {model.size && (
                            <Tag 
                              size="sm" 
                              colorScheme="blue" 
                              borderRadius="full" 
                              variant="subtle"
                            >
                              {formatModelSize(model.size)}
                            </Tag>
                          )}
                          
                          {model.name.includes('code') && (
                            <Tag 
                              size="sm" 
                              colorScheme="purple" 
                              variant="subtle"
                              borderRadius="full"
                            >
                              Code
                            </Tag>
                          )}
                          
                          {model.name.includes('embed') && (
                            <Tag 
                              size="sm" 
                              colorScheme="orange" 
                              variant="subtle"
                              borderRadius="full"
                            >
                              Embed
                            </Tag>
                          )}
                        </Flex>
                      </Box>
                    </Flex>
                  ))}
                </Grid>
              </Box>
            )}
            
            {availableModels.length > 0 && (
              <Box 
                p={4} 
                bg="var(--color-surface-dark)"
                borderRadius="md"
                borderWidth="1px"
                borderColor="var(--color-border)"
              >
                <Flex justify="space-between" align="center" mb={3}>
                  <Flex align="center">
                    <Box 
                      as="span"
                      bg="var(--color-primary)"
                      color="white"
                      fontWeight="bold"
                      w="24px"
                      h="24px"
                      borderRadius="full"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      mr={3}
                      fontSize="sm"
                    >
                      3
                    </Box>
                    <Text fontWeight="medium" color="var(--color-text)">Save Selected Models to Database</Text>
                  </Flex>
                  
                  <Button
                    colorScheme="blue"
                    isDisabled={selectedModels.length === 0}
                    onClick={syncModels}
                    isLoading={syncLoading}
                    loadingText="Saving"
                    size="md"
                    borderRadius="lg"
                  >
                    Save {selectedModels.length} Models
                  </Button>
                </Flex>
                
                <Text fontSize="sm" color="var(--color-text-muted)" ml={10}>
                  Only the selected models will be available in your application. Unselected models will be deactivated.
                </Text>
              </Box>
            )}
            
            {models.length > 0 && (
              <Box 
                p={4} 
                bg="var(--color-surface-light)" 
                borderRadius="md" 
                borderWidth="1px" 
                borderColor="var(--color-border)"
                mt={6}
              >
                <Flex align="center" mb={2}>
                  <CheckCircleIcon color="green.500" mr={2} />
                  <Text fontWeight="medium" color="var(--color-text)">Database Status</Text>
                </Flex>
                <Text fontSize="sm" color="var(--color-text-muted)" ml={6}>
                  <b>{models.filter(m => m.is_active).length}</b> active models in database out of <b>{models.length}</b> total
                  {models.filter(m => !m.is_active).length > 0 && (
                    <> • <b>{models.filter(m => !m.is_active).length}</b> inactive models</>
                  )}
                </Text>
              </Box>
            )}
            
            {lastAction && (
              <Box mt={4}>
                <Text fontSize="sm" color="var(--color-text-muted)">
                  <b>Last action:</b> {lastAction}
                </Text>
              </Box>
            )}
          </CardBody>
        </Card>
      </VStack>
      
      <Modal isOpen={retryModal.isOpen} onClose={retryModal.onClose}>
        <ModalOverlay 
          bg="blackAlpha.700"
          backdropFilter="blur(5px)"
        />
        <ModalContent 
          bg="var(--color-surface)" 
          borderColor="var(--color-border)" 
          borderWidth="1px"
          borderRadius="xl"
          boxShadow="2xl"
        >
          <ModalHeader 
            color="var(--color-text)"
            borderBottomWidth="1px"
            borderColor="var(--color-border)"
            display="flex"
            alignItems="center"
          >
            <WarningIcon color="red.500" mr={2} />
            Operation Failed
          </ModalHeader>
          <ModalCloseButton color="var(--color-text)" />
          
          <ModalBody py={6}>
            <Alert 
              status="error" 
              mb={4} 
              borderRadius="md"
              variant="left-accent"
              borderWidth="1px"
              borderColor="red.300"
            >
              <AlertIcon />
              <AlertDescription fontWeight="medium">{lastError}</AlertDescription>
            </Alert>
            
            <Text 
              color="var(--color-text-secondary)"
              fontSize="md"
              display="flex"
              alignItems="center"
            >
              <Icon as={InfoIcon} mr={2} boxSize="3" color="blue.400" />
              Would you like to retry the operation?
            </Text>
          </ModalBody>
          
          <ModalFooter 
            borderTopWidth="1px"
            borderColor="var(--color-border)"
          >
            <Button 
              variant="outline" 
              mr={3} 
              onClick={retryModal.onClose}
              borderColor="var(--color-border)"
              color="var(--color-text)"
              _hover={{ bg: 'var(--color-surface-light)' }}
              borderRadius="lg"
            >
              Cancel
            </Button>
            <Button 
              bg="var(--color-primary)"
              color="white"
              onClick={handleRetry}
              isLoading={isRetrying}
              loadingText="Retrying"
              leftIcon={<RepeatClockIcon />}
              _hover={{ 
                bg: 'var(--color-primary-dark)',
                transform: "translateY(-1px)",
                boxShadow: "md"  
              }}
              borderRadius="lg"
              transition="all 0.2s"
            >
              Retry
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default OllamaSettings; 