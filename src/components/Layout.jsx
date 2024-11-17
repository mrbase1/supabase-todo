import { Box, Button, Flex, Spacer, IconButton, Badge } from '@chakra-ui/react'
import { FaBell } from 'react-icons/fa'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (user) {
      fetchUnreadNotifications()
      subscribeToNotifications()
    }
  }, [user])

  const fetchUnreadNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', user.id)
      .eq('read', false)

    if (!error) {
      setUnreadCount(data.length)
    }
  }

  const subscribeToNotifications = () => {
    const subscription = supabase
      .channel('custom-all-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.new.user_id === user.id) {
            fetchUnreadNotifications()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
  }

  return (
    <Box minH="100vh">
      <Flex bg="blue.500" color="white" p={4} align="center">
        <Box fontWeight="bold" fontSize="xl">
          Todo App
        </Box>
        <Spacer />
        {user && (
          <Flex align="center" gap={4}>
            <Box position="relative">
              <IconButton
                icon={<FaBell />}
                variant="ghost"
                colorScheme="whiteAlpha"
                aria-label="Notifications"
              />
              {unreadCount > 0 && (
                <Badge
                  position="absolute"
                  top="-2px"
                  right="-2px"
                  colorScheme="red"
                  borderRadius="full"
                >
                  {unreadCount}
                </Badge>
              )}
            </Box>
            <Button colorScheme="whiteAlpha" onClick={handleSignOut}>
              Sign Out
            </Button>
          </Flex>
        )}
      </Flex>
      <Box p={4}>
        <Outlet />
      </Box>
    </Box>
  )
}
