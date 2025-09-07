import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Avatar,
} from '@mui/material';
import {
  Create as CreateIcon,
  Send as SubmitIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  Publish as PublishIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { WorkflowEntry } from '@/types';

interface WorkflowHistoryProps {
  workflowHistory: WorkflowEntry[];
  compact?: boolean;
}

const actionConfig = {
  CREATE: {
    icon: <CreateIcon fontSize="small" />,
    color: 'grey' as const,
    label: 'Created',
    bgColor: '#f3f4f6',
  },
  SUBMIT: {
    icon: <SubmitIcon fontSize="small" />,
    color: 'primary' as const,
    label: 'Submitted',
    bgColor: '#dbeafe',
  },
  APPROVE: {
    icon: <ApproveIcon fontSize="small" />,
    color: 'success' as const,
    label: 'Approved',
    bgColor: '#d1fae5',
  },
  REJECT: {
    icon: <RejectIcon fontSize="small" />,
    color: 'error' as const,
    label: 'Rejected',
    bgColor: '#fee2e2',
  },
  PUBLISH: {
    icon: <PublishIcon fontSize="small" />,
    color: 'success' as const,
    label: 'Published',
    bgColor: '#d1fae5',
  },
};

const WorkflowHistory: React.FC<WorkflowHistoryProps> = ({
  workflowHistory,
  compact = false,
}) => {
  if (!workflowHistory || workflowHistory.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No workflow history available
        </Typography>
      </Box>
    );
  }

  // Sort by timestamp (newest first)
  const sortedHistory = [...workflowHistory].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (compact) {
    return (
      <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
        {sortedHistory.map((entry, index) => {
          const config = actionConfig[entry.action] || actionConfig.CREATE;
          
          return (
            <Box
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                mb: 1,
                bgcolor: config.bgColor,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: `${config.color}.main` }}>
                {config.icon}
              </Avatar>
              
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {config.label} by {entry.actionBy}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {entry.fromState && `${entry.fromState} → `}{entry.toState}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {new Date(entry.timestamp).toLocaleString()}
                </Typography>
                {entry.comments && (
                  <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                    "{entry.comments}"
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    );
  }

  return (
    <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
      {sortedHistory.map((entry, index) => {
        const config = actionConfig[entry.action] || actionConfig.CREATE;
        
        return (
          <Paper key={index} sx={{ p: 2, mb: 2, position: 'relative' }}>
            {/* Timeline connector line */}
            {index < sortedHistory.length - 1 && (
              <Box
                sx={{
                  position: 'absolute',
                  left: 20,
                  top: 56,
                  bottom: -16,
                  width: 2,
                  bgcolor: 'divider',
                  zIndex: 0,
                }}
              />
            )}
            
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Avatar 
                sx={{ 
                  width: 40, 
                  height: 40, 
                  bgcolor: `${config.color}.main`,
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                {config.icon}
              </Avatar>
              
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="h6" component="span">
                    {config.label}
                  </Typography>
                  <Chip
                    icon={<PersonIcon fontSize="small" />}
                    label={entry.actionBy}
                    size="small"
                    variant="outlined"
                  />
                </Box>
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {entry.fromState && `${entry.fromState} → `}{entry.toState}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {new Date(entry.timestamp).toLocaleString()}
                </Typography>
                
                {entry.comments && (
                  <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="body2">
                      <strong>Comments:</strong> {entry.comments}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
};

export default WorkflowHistory;