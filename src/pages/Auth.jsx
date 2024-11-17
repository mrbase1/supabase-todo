import { useState } from 'react'
import {
  Box,
  Button,
  Stack,
  Input,
  Text,
  useToast,
  Container,
  Heading,
} from '@chakra-ui/react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (isSignUp) {
        const { error } = await signUp({ email, password })
        if (error) throw error
        toast({
          title: 'Account created.',
          description: 'Please check your email for verification.',
          status: 'success',
        })
      } else {
        const { error } = await signIn({ email, password })
        if (error) throw error
        navigate('/')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container maxW="container.sm" py={8}>
      <Stack spacing={8} align="center">
        <Heading>{isSignUp ? 'Create Account' : 'Sign In'}</Heading>
        <Box w="100%" as="form" onSubmit={handleSubmit}>
          <Stack spacing={4}>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button
              type="submit"
              colorScheme="blue"
              width="100%"
              isLoading={isLoading}
            >
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </Button>
          </Stack>
        </Box>
        <Text>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <Button
            variant="link"
            onClick={() => setIsSignUp(!isSignUp)}
            colorScheme="blue"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </Button>
        </Text>
      </Stack>
    </Container>
  )
}
