import React from 'react'
import { useAuthStore } from '@/store/authStore'
import AuthorDashboard from '@/components/dashboards/AuthorDashboard'
import EditorDashboard from '@/components/dashboards/EditorDashboard'
import PublisherDashboard from '@/components/dashboards/PublisherDashboard'
import ReaderDashboard from '@/components/dashboards/ReaderDashboard'
import { Box, Typography } from '@mui/material'

const DashboardPage: React.FC = () => {
  const { user } = useAuthStore()

  if (!user) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h5" color="text.secondary">
          Please log in to access your dashboard
        </Typography>
      </Box>
    )
  }

  const getRoleSpecificDashboard = () => {
    switch (user.role) {
      case 'AUTHOR':
        return <AuthorDashboard />
      case 'EDITOR':
        return <EditorDashboard />
      case 'PUBLISHER':
        return <PublisherDashboard />
      case 'READER':
        return <ReaderDashboard />
      default:
        return (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="h5" color="text.secondary">
              Unknown user role: {user.role}
            </Typography>
          </Box>
        )
    }
  }

  return getRoleSpecificDashboard()
}

export default DashboardPage