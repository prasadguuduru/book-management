import React from 'react';
import {
  Box,
  Chip,
  Tooltip,
  Typography,
  LinearProgress,
} from '@mui/material';
import {
  Edit as DraftIcon,
  Send as SubmittedIcon,
  CheckCircle as ReadyIcon,
  Publish as PublishedIcon,
} from '@mui/icons-material';
import { Book } from '@/types';

interface WorkflowStatusIndicatorProps {
  status: Book['status'];
  showProgress?: boolean;
  size?: 'small' | 'medium';
  variant?: 'chip' | 'detailed';
}

const statusConfig = {
  DRAFT: {
    label: 'Draft',
    color: 'default' as const,
    icon: <DraftIcon fontSize="small" />,
    description: 'Book is being written by the author',
    progress: 25,
    bgColor: '#f3f4f6',
    textColor: '#6b7280',
  },
  SUBMITTED_FOR_EDITING: {
    label: 'Under Review',
    color: 'warning' as const,
    icon: <SubmittedIcon fontSize="small" />,
    description: 'Book is being reviewed by an editor',
    progress: 50,
    bgColor: '#fef3c7',
    textColor: '#d97706',
  },
  READY_FOR_PUBLICATION: {
    label: 'Ready to Publish',
    color: 'info' as const,
    icon: <ReadyIcon fontSize="small" />,
    description: 'Book is approved and ready for publication',
    progress: 75,
    bgColor: '#dbeafe',
    textColor: '#2563eb',
  },
  PUBLISHED: {
    label: 'Published',
    color: 'success' as const,
    icon: <PublishedIcon fontSize="small" />,
    description: 'Book is published and available to readers',
    progress: 100,
    bgColor: '#d1fae5',
    textColor: '#059669',
  },
};

const WorkflowStatusIndicator: React.FC<WorkflowStatusIndicatorProps> = ({
  status,
  showProgress = false,
  size = 'medium',
  variant = 'chip',
}) => {
  const config = statusConfig[status];

  if (variant === 'detailed') {
    return (
      <Box sx={{ minWidth: 200 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {config.icon}
          <Typography variant="body2" sx={{ fontWeight: 600, color: config.textColor }}>
            {config.label}
          </Typography>
        </Box>
        
        {showProgress && (
          <Box sx={{ mb: 1 }}>
            <LinearProgress
              variant="determinate"
              value={config.progress}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: '#f3f4f6',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: config.textColor,
                  borderRadius: 3,
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {config.progress}% Complete
            </Typography>
          </Box>
        )}
        
        <Typography variant="caption" color="text.secondary">
          {config.description}
        </Typography>
      </Box>
    );
  }

  return (
    <Tooltip title={config.description} arrow>
      <Chip
        icon={config.icon}
        label={config.label}
        color={config.color}
        size={size}
        sx={{
          fontWeight: 500,
          '& .MuiChip-icon': {
            color: 'inherit',
          },
        }}
      />
    </Tooltip>
  );
};

export default WorkflowStatusIndicator;