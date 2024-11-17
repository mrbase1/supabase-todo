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
import { FaShare, FaCalendar, FaBell, FaEllipsisV, FaEdit, FaTrash } from 'react-icons/fa'
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
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [editTodo, setEditTodo] = useState('')
  const [editDueDate, setEditDueDate] = useState(null)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { 
    isOpen: isEditOpen, 
    onOpen: onEditOpen, 
    onClose: onEditClose 
  } = useDisclosure()
  const {
    isOpen: isNotificationOpen,
    onOpen: onNotificationOpen,
    onClose: onNotificationClose
  } = useDisclosure()
  const {
    isOpen: isNotificationDetailOpen,
    onOpen: onNotificationDetailOpen,
    onClose: onNotificationDetailClose
  } = useDisclosure()
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

  const markNotificationAsRead = async (notificationId) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)

    if (error) {
      console.error('Error marking notification as read:', error)
    } else {
      // Update the local state to reflect the change
      setNotifications(notifications.map(notification =>
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      ))
    }
  }

  const markAllNotificationsAsRead = async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)

    if (error) {
      console.error('Error marking all notifications as read:', error)
    } else {
      // Update the local state to reflect the change
      setNotifications(notifications.map(notification => ({
        ...notification,
        read: true
      })))
    }
  }

  const hasUnreadNotifications = notifications.some(notification => !notification.read)

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

  const handleEdit = (todo) => {
    setSelectedTodo(todo)
    setEditTodo(todo.title)
    setEditDueDate(todo.due_date ? new Date(todo.due_date) : null)
    onEditOpen()
  }

  const updateTodo = async () => {
    if (!editTodo.trim() || !selectedTodo) return

    const { error } = await supabase
      .from('todos')
      .update({
        title: editTodo,
        due_date: editDueDate,
      })
      .eq('id', selectedTodo.id)

    if (error) {
      toast({
        title: 'Error updating todo',
        description: error.message,
        status: 'error',
      })
    } else {
      toast({
        title: 'Success',
        description: 'Todo updated successfully',
        status: 'success',
      })
      onEditClose()
      fetchTodos()
    }
  }

  const deleteTodo = async (todoId) => {
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', todoId)

    if (error) {
      toast({
        title: 'Error deleting todo',
        description: error.message,
        status: 'error',
      })
    } else {
      toast({
        title: 'Success',
        description: 'Todo deleted successfully',
        status: 'success',
      })
      fetchTodos()
    }
  }

  return (
    <Container maxW="container.md" py={8}>
      <Stack spacing={8}>
        <HStack justify="space-between">
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
          <Menu>
            <MenuButton
              as={IconButton}
              aria-label="Notifications"
              icon={
                <Box position="relative">
                  <FaBell />
                  {hasUnreadNotifications && (
                    <Box
                      position="absolute"
                      top="-2px"
                      right="-2px"
                      bg="red.500"
                      borderRadius="full"
                      w="2"
                      h="2"
                    />
                  )}
                </Box>
              }
              variant="ghost"
            />
            <MenuList maxH="300px" overflowY="auto">
              {notifications.length === 0 ? (
                <MenuItem>No new notifications</MenuItem>
              ) : (
                <>
                  {notifications.slice(0, 5).map((notification) => (
                    <MenuItem 
                      key={notification.id} 
                      fontSize="sm"
                      onClick={() => {
                        setSelectedNotification(notification)
                        onNotificationDetailOpen()
                        if (!notification.read) {
                          markNotificationAsRead(notification.id)
                        }
                      }}
                    >
                      <HStack spacing={2} flex={1}>
                        {!notification.read && (
                          <Box
                            w="2"
                            h="2"
                            bg="blue.500"
                            borderRadius="full"
                          />
                        )}
                        <Text>
                          {notification.content.length > 100 
                            ? `${notification.content.substring(0, 100)}...` 
                            : notification.content}
                        </Text>
                      </HStack>
                    </MenuItem>
                  ))}
                  {notifications.length > 5 && (
                    <MenuItem
                      onClick={onNotificationOpen}
                      color="blue.500"
                      fontWeight="semibold"
                    >
                      View all notifications
                    </MenuItem>
                  )}
                  {hasUnreadNotifications && (
                    <MenuItem
                      onClick={markAllNotificationsAsRead}
                      color="gray.500"
                      fontSize="sm"
                    >
                      Mark all as read
                    </MenuItem>
                  )}
                </>
              )}
            </MenuList>
          </Menu>
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
                        <MenuItem
                          icon={<FaEdit />}
                          onClick={() => handleEdit(todo)}
                        >
                          Edit
                        </MenuItem>
                        <MenuItem
                          icon={<FaTrash />}
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this todo?')) {
                              deleteTodo(todo.id)
                            }
                          }}
                          color="red.500"
                        >
                          Delete
                        </MenuItem>
                      </MenuList>
                    </Menu>
                  )}
                </HStack>
              </HStack>
            </Box>
          ))}
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

        <Modal isOpen={isEditOpen} onClose={onEditClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Edit Todo</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Stack spacing={4}>
                <FormControl>
                  <FormLabel>Task</FormLabel>
                  <Input
                    value={editTodo}
                    onChange={(e) => setEditTodo(e.target.value)}
                    placeholder="Enter task"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Due Date</FormLabel>
                  <DatePicker
                    selected={editDueDate}
                    onChange={(date) => setEditDueDate(date)}
                    dateFormat="MMMM d, yyyy"
                    isClearable
                    customInput={<Input />}
                  />
                </FormControl>
              </Stack>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="blue" mr={3} onClick={updateTodo}>
                Save Changes
              </Button>
              <Button variant="ghost" onClick={onEditClose}>
                Cancel
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* All Notifications Modal */}
        <Modal isOpen={isNotificationOpen} onClose={onNotificationClose} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>
              <HStack>
                <FaBell />
                <Text>Notifications</Text>
              </HStack>
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Stack spacing={4} maxH="60vh" overflowY="auto">
                {notifications.length === 0 ? (
                  <Text color="gray.500">No notifications</Text>
                ) : (
                  notifications.map((notification) => (
                    <Box
                      key={notification.id}
                      p={4}
                      borderWidth="1px"
                      borderRadius="md"
                      _hover={{ bg: "gray.50", cursor: "pointer" }}
                      onClick={() => {
                        setSelectedNotification(notification)
                        onNotificationDetailOpen()
                        if (!notification.read) {
                          markNotificationAsRead(notification.id)
                        }
                      }}
                    >
                      <HStack spacing={2} align="flex-start">
                        {!notification.read && (
                          <Box
                            w="2"
                            h="2"
                            bg="blue.500"
                            borderRadius="full"
                            mt={1}
                          />
                        )}
                        <Stack spacing={1} flex={1}>
                          <Text fontSize="sm">
                            {notification.content.length > 100 
                              ? `${notification.content.substring(0, 100)}...` 
                              : notification.content}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            {new Date(notification.created_at).toLocaleDateString()} {new Date(notification.created_at).toLocaleTimeString()}
                          </Text>
                        </Stack>
                      </HStack>
                    </Box>
                  ))
                )}
              </Stack>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={onNotificationClose}>
                Close
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Single Notification Detail Modal */}
        <Modal isOpen={isNotificationDetailOpen} onClose={onNotificationDetailClose}>
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>
              <HStack>
                <FaBell />
                <Text>Notification Detail</Text>
              </HStack>
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {selectedNotification && (
                <Stack spacing={4}>
                  <Text>{selectedNotification.content}</Text>
                  <Text fontSize="sm" color="gray.500">
                    {new Date(selectedNotification.created_at).toLocaleDateString()}{' '}
                    {new Date(selectedNotification.created_at).toLocaleTimeString()}
                  </Text>
                </Stack>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={onNotificationDetailClose}>
                Close
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Stack>
    </Container>
  )
}
