import { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Stack,
  Input,
  Button,
  Text,
  useToast,
  Checkbox,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  FormControl,
  FormLabel,
  Badge,
  HStack,
  Tooltip,
} from '@chakra-ui/react'
import { FaShare, FaCalendar, FaBell, FaEllipsisV } from 'react-icons/fa'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

export default function Dashboard() {
  const [todos, setTodos] = useState([])
  const [newTodo, setNewTodo] = useState('')
  const [selectedTodo, setSelectedTodo] = useState(null)
  const [dueDate, setDueDate] = useState(null)
  const [shareEmail, setShareEmail] = useState('')
  const [notifications, setNotifications] = useState([])
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { user } = useAuth()
  const toast = useToast()

  useEffect(() => {
    if (user) {
      fetchTodos()
      fetchNotifications()
      subscribeToChanges()
    }
  }, [user])

  const subscribeToChanges = () => {
    const todoSubscription = supabase
      .channel('custom-all-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos' },
        (payload) => {
          if (payload.new.shared_with?.includes(user.id)) {
            toast({
              title: 'New todo shared with you!',
              description: payload.new.title,
              status: 'info',
            })
            fetchTodos()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(todoSubscription)
    }
  }

  const fetchTodos = async () => {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .or(`user_id.eq.${user.id},shared_with.cs.{${user.id}}`)
      .order('created_at', { ascending: false })

    if (error) {
      toast({
        title: 'Error fetching todos',
        description: error.message,
        status: 'error',
      })
    } else {
      setTodos(data || [])
    }
  }

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching notifications:', error)
    } else {
      setNotifications(data || [])
    }
  }

  const addTodo = async () => {
    if (!newTodo.trim()) return

    const { error } = await supabase.from('todos').insert([
      {
        title: newTodo,
        user_id: user.id,
        due_date: dueDate,
        completed: false,
        shared_with: [],
      },
    ])

    if (error) {
      toast({
        title: 'Error adding todo',
        description: error.message,
        status: 'error',
      })
    } else {
      setNewTodo('')
      setDueDate(null)
      fetchTodos()
    }
  }

  const toggleTodo = async (todoId, completed) => {
    const { error } = await supabase
      .from('todos')
      .update({ completed })
      .eq('id', todoId)

    if (error) {
      toast({
        title: 'Error updating todo',
        description: error.message,
        status: 'error',
      })
    } else {
      fetchTodos()
    }
  }

  const shareTodo = async () => {
    if (!shareEmail.trim() || !selectedTodo) return

    try {
      // First, get the user ID of the person we're sharing with
      const { data: profiles, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('email', shareEmail.trim())

      console.log('Profile search results:', { profiles, userError, searchEmail: shareEmail.trim() })

      if (userError) {
        throw userError
      }

      if (!profiles || profiles.length === 0) {
        toast({
          title: 'Error',
          description: 'User not found. Make sure the email is correct and the user has signed up.',
          status: 'error',
          duration: 5000,
        })
        return
      }

      const userData = profiles[0]
      console.log('Found user:', userData)

      // Get the current todo to check existing shared_with
      const { data: currentTodo, error: todoError } = await supabase
        .from('todos')
        .select('shared_with, title')
        .eq('id', selectedTodo.id)
        .single()

      if (todoError) {
        throw todoError
      }

      console.log('Current todo:', currentTodo)

      // Make sure we don't add duplicate shares
      const existingShares = currentTodo?.shared_with || []
      if (existingShares.includes(userData.id)) {
        toast({
          title: 'Already shared',
          description: 'This todo is already shared with this user',
          status: 'info',
        })
        return
      }

      // Update the todo with the new shared_with array
      const { error: updateError } = await supabase
        .from('todos')
        .update({
          shared_with: [...existingShares, userData.id]
        })
        .eq('id', selectedTodo.id)

      if (updateError) {
        throw updateError
      }

      // Create a notification for the shared user
      const { error: notifyError } = await supabase
        .from('notifications')
        .insert([
          {
            user_id: userData.id,
            type: 'SHARE',
            content: `${user.email} shared a todo with you: ${currentTodo.title}`,
          },
        ])

      if (notifyError) {
        throw notifyError
      }

      toast({
        title: 'Success',
        description: 'Todo shared successfully',
        status: 'success',
      })

      onClose()
      setShareEmail('')
      fetchTodos()
    } catch (error) {
      console.error('Share error:', error)
      toast({
        title: 'Error sharing todo',
        description: error.message || 'An error occurred while sharing the todo',
        status: 'error',
        duration: 5000,
      })
    }
  }

  const handleShare = (todo) => {
    setSelectedTodo(todo)
    onOpen()
  }

  return (
    <Container maxW="container.md" py={8}>
      <Stack spacing={8}>
        <HStack>
          <Input
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Add a new todo..."
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                addTodo()
              }
            }}
          />
          <Tooltip label="Set due date">
            <IconButton
              icon={<FaCalendar />}
              onClick={() => setDueDate(new Date())}
            />
          </Tooltip>
          <Button onClick={addTodo}>Add</Button>
        </HStack>

        {dueDate && (
          <Box bg="white" p={4} borderRadius="md" shadow="sm">
            <DatePicker
              selected={dueDate}
              onChange={(date) => setDueDate(date)}
              dateFormat="MMMM d, yyyy"
              inline
            />
          </Box>
        )}

        <Stack spacing={4}>
          {todos.map((todo) => (
            <Box
              key={todo.id}
              p={4}
              borderWidth="1px"
              borderRadius="lg"
              bg="white"
            >
              <HStack justify="space-between">
                <HStack flex={1}>
                  <Checkbox
                    isChecked={todo.completed}
                    onChange={(e) => toggleTodo(todo.id, e.target.checked)}
                  />
                  <Stack spacing={0}>
                    <Text>{todo.title}</Text>
                    {todo.due_date && (
                      <Text fontSize="sm" color="gray.500">
                        Due: {new Date(todo.due_date).toLocaleDateString()}
                      </Text>
                    )}
                  </Stack>
                </HStack>
                <HStack>
                  {todo.shared_with?.length > 0 && (
                    <Badge colorScheme="green">Shared</Badge>
                  )}
                  {todo.user_id === user.id && (
                    <Menu>
                      <MenuButton
                        as={IconButton}
                        icon={<FaEllipsisV />}
                        variant="ghost"
                        size="sm"
                      />
                      <MenuList>
                        <MenuItem
                          icon={<FaShare />}
                          onClick={() => handleShare(todo)}
                        >
                          Share
                        </MenuItem>
                      </MenuList>
                    </Menu>
                  )}
                </HStack>
              </HStack>
            </Box>
          ))}
        </Stack>

        {notifications.length > 0 && (
          <Box p={4} borderWidth="1px" borderRadius="lg" bg="white">
            <HStack mb={4}>
              <FaBell />
              <Text fontWeight="bold">Notifications</Text>
            </HStack>
            <Stack spacing={2}>
              {notifications.map((notification) => (
                <Text key={notification.id} fontSize="sm">
                  {notification.content}
                </Text>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Share Todo</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>Share with (email)</FormLabel>
              <Input
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="Enter email address"
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={shareTodo}>
              Share
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  )
}
