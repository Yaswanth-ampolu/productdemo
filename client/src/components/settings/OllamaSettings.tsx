import React, { useState, useEffect } from 'react';
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
  AlertTitle,
  AlertDescription,
  Divider
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
import { Card, CardBody, CardHeader } from '@chakra-ui/card';
import { api } from '../../services/api';
import { CheckCircleIcon, WarningIcon, RepeatIcon } from '@chakra-ui/icons';
import axios from 'axios';

interface OllamaSettingsProps {
  isAdmin: boolean;
}

interface OllamaSettings {
  host: string;
  port: number;
  default_model: string;
}

interface AIModel {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  ollama_model_id: string;
  parameters: any;
  created_at: string;
  updated_at: string;
}

const OllamaSettings: React.FC<OllamaSettingsProps> = ({ isAdmin }) => {
  const [settings, setSettings] = useState<OllamaSettings>({
    host: 'localhost',
    port: 11434,
    default_model: ''
  });
  const [models, setModels] = useState<AIModel[]>([]);
  const [saveLoading, setSaveLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'error' | 'testing'>('unknown');
  const [lastAction, setLastAction] = useState<string>('');
  const toast = useToast();
  const [availableModels, setAvailableModels] = useState<any[]>([]);

  // Load settings on component mount
  useEffect(() => {
    if (isAdmin) {
      loadSettings();
      loadModels();
    }
  }, [isAdmin]);

  const loadSettings = async () => {
    try {
      setLastAction('Loading settings...');
      const response = await axios.get('/api/ollama/settings');
      
      if (response.data.success) {
        setSettings(response.data.settings);
        setLastAction('Settings loaded successfully');
      } else {
        setLastAction('Failed to load settings: ' + (response.data.message || 'Unknown error'));
        showToast({
          title: 'Error loading settings',
          description: response.data.message || 'Could not load Ollama settings',
          status: 'error'
        });
      }
    } catch (error: any) {
      console.error('Error loading Ollama settings:', error);
      setLastAction('Failed to load settings');
      
      showToast({
        title: 'Error loading settings',
        description: error.response?.data?.message || error.message || 'Failed to load Ollama settings',
        status: 'error'
      });
    }
  };

  const loadModels = async () => {
    try {
      setModelsLoading(true);
      setLastAction('Loading models from database...');
      
      const response = await axios.get('/api/ollama/models/db');
      
      if (response.data.success) {
        setModels(response.data.models || []);
        setLastAction(`Loaded ${response.data.models?.length || 0} models from database`);
      } else {
        setLastAction('Failed to load models: ' + (response.data.message || 'Unknown error'));
        showToast({
          title: 'Error loading models',
          description: response.data.message || 'Could not load AI models from database',
          status: 'error'
        });
      }
    } catch (error: any) {
      console.error('Error loading AI models:', error);
      setLastAction('Failed to load models from database');
      
      showToast({
        title: 'Error loading models',
        description: error.response?.data?.message || error.message || 'Failed to load AI models from database',
        status: 'error'
      });
    } finally {
      setModelsLoading(false);
    }
  };

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
      
      const response = await axios.put('/api/ollama/settings', settings);
      
      if (response.data.success) {
        setLastAction('Settings saved successfully');
        setConnectionStatus('unknown'); // Reset connection status after changing settings
        showToast({
          title: 'Settings saved',
          description: response.data.message || 'Ollama connection settings have been updated',
          status: 'success'
        });
      } else {
        setLastAction('Failed to save settings: ' + (response.data.message || 'Unknown error'));
        showToast({
          title: 'Error saving settings',
          description: response.data.message || 'There was a problem saving your settings',
          status: 'error'
        });
      }
    } catch (error: any) {
      console.error('Error saving Ollama settings:', error);
      setLastAction('Failed to save settings');
      
      showToast({
        title: 'Error saving settings',
        description: error.response?.data?.message || error.message || 'Failed to save Ollama connection settings',
        status: 'error'
      });
    } finally {
      setSaveLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setTestLoading(true);
      setLastAction('Testing connection to Ollama server...');
      setConnectionStatus('testing');

      const response = await axios.post('/api/ollama/test-connection', {
        host: settings.host,
        port: settings.port
      });

      if (response.data.success) {
        setConnectionStatus('success');
        setLastAction(`Connection successful: ${response.data.message || 'Connected to Ollama server'}`);
        showToast({
          title: 'Connection successful',
          description: response.data.message || 'Successfully connected to Ollama server',
          status: 'success'
        });
      } else {
        setConnectionStatus('error');
        setLastAction(`Connection failed: ${response.data.message || 'Could not connect to Ollama server'}`);
        showToast({
          title: 'Connection failed',
          description: response.data.message || 'Failed to connect to Ollama server',
          status: 'error'
        });
      }
    } catch (error: any) {
      console.error('Error testing connection:', error);
      setConnectionStatus('error');
      setLastAction('Connection test failed');
      
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

  const fetchAvailableModels = async () => {
    try {
      setFetchLoading(true);
      setLastAction('Fetching available models from Ollama server...');
      
      const response = await axios.get('/api/ollama/models/available');
      
      if (response.data.success) {
        setAvailableModels(response.data.models || []);
        setLastAction(`Found ${response.data.models.length} available models on Ollama server`);
        showToast({
          title: 'Models fetched',
          description: `Successfully fetched ${response.data.models.length} models from Ollama server`,
          status: 'success'
        });
      } else {
        setLastAction('Failed to fetch models: ' + (response.data.message || 'Unknown error'));
        showToast({
          title: 'Failed to fetch models',
          description: response.data.message || 'Could not fetch models from Ollama server',
          status: 'error'
        });
      }
    } catch (error: any) {
      console.error('Error fetching available models:', error);
      setLastAction('Failed to fetch models from Ollama server');
      
      showToast({
        title: 'Failed to fetch models',
        description: error.response?.data?.message || error.message || 'Error contacting the Ollama server',
        status: 'error'
      });
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
      setLastAction('Syncing models with Ollama server...');
      
      const response = await axios.post('/api/ollama/models/sync');
      
      if (response.data.success) {
        setLastAction(`Models synced successfully: ${response.data.syncedCount} models updated`);
        showToast({
          title: 'Models synced',
          description: `Successfully synced ${response.data.syncedCount} models with database`,
          status: 'success'
        });
        // Reload models from the database to show updates
        loadModels();
      } else {
        setLastAction('Failed to sync models: ' + (response.data.message || 'Unknown error'));
        showToast({
          title: 'Sync failed',
          description: response.data.message || 'Failed to sync models with database',
          status: 'error'
        });
      }
    } catch (error: any) {
      console.error('Error syncing models:', error);
      setLastAction('Failed to sync models with database');
      
      showToast({
        title: 'Sync failed',
        description: error.response?.data?.message || error.message || 'Error syncing models with database',
        status: 'error'
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const toggleModelStatus = async (modelId: string, isActive: boolean) => {
    try {
      setLastAction(`${isActive ? 'Activating' : 'Deactivating'} model ${modelId}...`);
      
      const response = await axios.put(`/api/ollama/models/${modelId}/status`, {
        is_active: isActive
      });
      
      if (response.data.success) {
        setLastAction(`Model ${modelId} ${isActive ? 'activated' : 'deactivated'} successfully`);
        showToast({
          title: `Model ${isActive ? 'activated' : 'deactivated'}`,
          description: `The model has been ${isActive ? 'activated' : 'deactivated'} successfully`,
          status: 'success'
        });
        
        // Update local state to reflect the change
        setModels(prevModels => prevModels.map(model => 
          model.id === modelId ? { ...model, is_active: isActive } : model
        ));
      } else {
        setLastAction(`Failed to ${isActive ? 'activate' : 'deactivate'} model: ${response.data.message || 'Unknown error'}`);
        showToast({
          title: 'Status update failed',
          description: response.data.message || `Could not ${isActive ? 'activate' : 'deactivate'} the model`,
          status: 'error'
        });
      }
    } catch (error: any) {
      console.error(`Error ${isActive ? 'activating' : 'deactivating'} model:`, error);
      setLastAction(`Failed to ${isActive ? 'activate' : 'deactivate'} model`);
      
      showToast({
        title: 'Status update failed',
        description: error.response?.data?.message || error.message || `Error ${isActive ? 'activating' : 'deactivating'} the model`,
        status: 'error'
      });
    }
  };

  const renderConnectionStatusIcon = () => {
    if (connectionStatus === 'success') {
      return <CheckCircleIcon color="green.500" />;
    } else if (connectionStatus === 'error') {
      return <WarningIcon color="red.500" />;
    } else {
      return <RepeatIcon color="gray.500" />; // Default icon for 'unknown' status
    }
  };

  if (!isAdmin) {
    return (
      <Box p={4}>
        <Text>You need administrator privileges to access Ollama settings.</Text>
      </Box>
    );
  }

  return (
    <Box p={6} bgColor="gray.900" borderRadius="lg">
      <VStack gap={8} align="stretch">
        <Card variant="elevated" boxShadow="lg" borderRadius="xl" overflow="hidden">
          <CardHeader bg="blue.800" py={4} color="white" borderBottomWidth="1px" borderColor="blue.700">
            <Heading size="md">Ollama API Settings</Heading>
          </CardHeader>
          <CardBody p={6} bg="gray.800" color="white">
            <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={6}>
              <FormControl>
                <FormLabel fontWeight="medium">Host</FormLabel>
                <Input
                  name="host"
                  value={settings.host}
                  onChange={handleInputChange}
                  placeholder="localhost"
                  bg="gray.700"
                  borderColor="gray.600"
                  _hover={{ borderColor: "blue.400" }}
                  color="white"
                />
              </FormControl>
              
              <FormControl>
                <FormLabel fontWeight="medium">Port</FormLabel>
                <Input
                  name="port"
                  type="number"
                  value={settings.port}
                  onChange={handleInputChange}
                  placeholder="11434"
                  bg="gray.700"
                  borderColor="gray.600"
                  _hover={{ borderColor: "blue.400" }}
                  color="white"
                />
              </FormControl>
              
              <FormControl gridColumn={{ md: "span 2" }}>
                <FormLabel fontWeight="medium">Default Model</FormLabel>
                <Input
                  name="default_model"
                  value={settings.default_model}
                  onChange={handleInputChange}
                  placeholder="Select a default model"
                  bg="gray.700"
                  borderColor="gray.600"
                  _hover={{ borderColor: "blue.400" }}
                  color="white"
                />
              </FormControl>
            </Grid>
            
            <Flex direction="column" gap={5} mt={8}>
              <HStack gap={5} flexWrap="wrap">
                <Tooltip label="Save these connection settings to the server">
                  <Button
                    colorScheme="blue"
                    onClick={saveSettings}
                    isLoading={saveLoading}
                    loadingText="Saving"
                    leftIcon={saveLoading ? undefined : <CheckCircleIcon />}
                    size="md"
                    px={8}
                    py={5}
                    borderRadius="md"
                    _hover={{ transform: "translateY(-2px)", boxShadow: "lg" }}
                  >
                    Save Settings
                  </Button>
                </Tooltip>
                
                <Tooltip label="Test connection to the Ollama server with these settings">
                  <Button
                    colorScheme={connectionStatus === 'success' ? 'green' : connectionStatus === 'error' ? 'red' : connectionStatus === 'testing' ? 'blue' : 'gray'}
                    onClick={testConnection}
                    isLoading={testLoading}
                    loadingText="Testing"
                    leftIcon={renderConnectionStatusIcon()}
                    size="md"
                    px={8}
                    py={5}
                    borderRadius="md"
                    _hover={{ transform: "translateY(-2px)", boxShadow: "lg" }}
                  >
                    {connectionStatus === 'success' ? 'Connection Successful' : 
                     connectionStatus === 'error' ? 'Connection Failed' : 
                     connectionStatus === 'testing' ? 'Testing Connection...' : 'Test Connection'}
                  </Button>
                </Tooltip>
              </HStack>
              
              {lastAction && (
                <Alert status={lastAction.includes('failed') || lastAction.includes('Failed') ? 'error' : 
                        lastAction.includes('successful') || lastAction.includes('success') ? 'success' : 'info'} 
                       borderRadius="md"
                       variant="solid"
                       mt={3}>
                  <AlertIcon />
                  <AlertDescription>{lastAction}</AlertDescription>
                </Alert>
              )}
            </Flex>
          </CardBody>
        </Card>
        
        <Card variant="elevated" boxShadow="lg" borderRadius="xl" overflow="hidden">
          <CardHeader bg="purple.800" py={4} color="white" borderBottomWidth="1px" borderColor="purple.700">
            <Heading size="md">Model Management</Heading>
          </CardHeader>
          <CardBody p={6} bg="gray.800" color="white">
            <HStack gap={5} mb={8} flexWrap="wrap">
              <Tooltip label="Fetch available models from the Ollama server">
                <Button
                  colorScheme="teal"
                  onClick={fetchAvailableModels}
                  isLoading={fetchLoading}
                  loadingText="Fetching"
                  leftIcon={<RepeatIcon />}
                  size="md"
                  px={6}
                  py={5}
                  borderRadius="md"
                  _hover={{ transform: "translateY(-2px)", boxShadow: "lg" }}
                >
                  Fetch Available Models
                </Button>
              </Tooltip>
              
              <Tooltip label="Sync models from Ollama server to the database">
                <Button
                  colorScheme="purple"
                  onClick={syncModels}
                  isLoading={syncLoading}
                  loadingText="Syncing"
                  leftIcon={<RepeatIcon />}
                  size="md"
                  px={6}
                  py={5}
                  borderRadius="md"
                  _hover={{ transform: "translateY(-2px)", boxShadow: "lg" }}
                >
                  Sync Models to Database
                </Button>
              </Tooltip>
            </HStack>
            
            {availableModels.length > 0 && (
              <Box mb={6}>
                <Text fontWeight="medium" mb={3}>Available Models on Server: {availableModels.length}</Text>
                <Box maxH="200px" overflowY="auto" borderWidth="1px" borderRadius="md" p={4} bg="gray.700" borderColor="gray.600">
                  {availableModels.map((model: any, index: number) => (
                    <Flex 
                      key={index} 
                      justify="space-between" 
                      align="center" 
                      py={2} 
                      px={3}
                      borderBottomWidth={index < availableModels.length - 1 ? "1px" : "0"} 
                      borderColor="gray.600"
                      _hover={{ bg: "gray.600" }}
                      borderRadius="sm"
                    >
                      <Text fontSize="sm" fontWeight="medium" color="white">
                        {model.name}
                      </Text>
                      <Text fontSize="xs" color="gray.300">
                        {model.size && formatModelSize(model.size)}
                      </Text>
                    </Flex>
                  ))}
                </Box>
                <Divider my={5} borderColor="gray.600" />
              </Box>
            )}
            
            {modelsLoading ? (
              <Flex justify="center" align="center" h="250px" direction="column" gap={5}>
                <Spinner size="xl" thickness="4px" color="purple.400" speed="0.8s" />
                <Text color="gray.300">Loading models from database...</Text>
              </Flex>
            ) : models.length === 0 ? (
              <Flex 
                textAlign="center" 
                py={12} 
                px={6}
                borderWidth="1px" 
                borderRadius="lg" 
                direction="column" 
                align="center" 
                justify="center"
                bg="gray.700"
                borderColor="gray.600"
              >
                <WarningIcon boxSize={12} color="yellow.400" mb={5} />
                <Text fontSize="xl" fontWeight="medium" mb={2}>No models found</Text>
                <Text color="gray.300" mb={6}>Click "Sync Models" to import models from the Ollama server.</Text>
                <Button
                  colorScheme="purple"
                  onClick={syncModels}
                  isLoading={syncLoading}
                  loadingText="Syncing"
                  leftIcon={<RepeatIcon />}
                  size="lg"
                  px={8}
                  py={6}
                  borderRadius="md"
                  _hover={{ transform: "translateY(-2px)", boxShadow: "lg" }}
                >
                  Sync Models Now
                </Button>
              </Flex>
            ) : (
              <TableContainer borderWidth="1px" borderRadius="md" bg="gray.700" borderColor="gray.600">
                <Table variant="simple" colorScheme="whiteAlpha">
                  <Thead bg="gray.800">
                    <Tr>
                      <Th color="gray.300">Model Name</Th>
                      <Th color="gray.300">Ollama ID</Th>
                      <Th color="gray.300">Description</Th>
                      <Th color="gray.300">Status</Th>
                      <Th color="gray.300">Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {models.map((model) => (
                      <Tr key={model.id} _hover={{ bg: "gray.600" }}>
                        <Td fontWeight="medium" color="white">{model.name}</Td>
                        <Td><Text fontSize="sm" color="gray.300">{model.ollama_model_id}</Text></Td>
                        <Td><Text fontSize="sm" noOfLines={2} color="gray.300">{model.description || 'No description'}</Text></Td>
                        <Td>
                          <Badge colorScheme={model.is_active ? 'green' : 'red'} px={3} py={1} borderRadius="md">
                            {model.is_active ? 'Active' : 'Disabled'}
                          </Badge>
                        </Td>
                        <Td>
                          <Tooltip label={model.is_active ? 'Deactivate this model' : 'Activate this model'}>
                            <Switch
                              colorScheme="green"
                              size="md"
                              isChecked={model.is_active}
                              onChange={(e) => toggleModelStatus(model.id, e.target.checked)}
                            />
                          </Tooltip>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            )}
          </CardBody>
        </Card>
      </VStack>
    </Box>
  );
};

export default OllamaSettings; 