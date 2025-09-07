import React from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Typography,
  Paper,
  Chip,
} from '@mui/material';
import {
  Edit as DraftIcon,
  Send as SubmittedIcon,
  CheckCircle as ReadyIcon,
  Publish as PublishedIcon,
} from '@mui/icons-material';
import { Book, WorkflowEntry } from '@/types';

interface WorkflowProgressTrackerProps {
  currentStatus: Book['status'];
  workflowHistory?: WorkflowEntry[];
  orientation?: 'horizontal' | 'vertical';
  showDetails?: boolean;
}

const workflowSteps = [
  {
    status: 'DRAFT' as Book['status'],
    label: 'Draft',
    icon: <DraftIcon />,
    description: 'Author is writing the book',
  },
  {
    status: 'SUBMITTED_FOR_EDITING' as Book['status'],
    label: 'Under Review',
    icon: <SubmittedIcon />,
    description: 'Editor is reviewing the book',
  },
  {
    status: 'READY_FOR_PUBLICATION' as Book['status'],
    label: 'Ready to Publish',
    icon: <ReadyIcon />,
    description: 'Book is approved and ready for publication',
  },
  {
    status: 'PUBLISHED' as Book['status'],
    label: 'Published',
    icon: <PublishedIcon />,
    description: 'Book is published and available to readers',
  },
];

const WorkflowProgressTracker: React.FC<WorkflowProgressTrackerProps> = ({
  currentStatus,
  workflowHistory = [],
  orientation = 'horizontal',
  showDetails = false,
}) => {
  const currentStepIndex = workflowSteps.findIndex(step => step.status === currentStatus);
  
  // Get workflow entry for each step
  const getWorkflowEntryForStatus = (status: Book['status']) => {
    return workflowHistory.find(entry => entry.toState === status);
  };

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStepIndex) return 'completed';
    if (stepIndex === currentStepIndex) return 'active';
    return 'inactive';
  };

  if (orientation === 'vertical') {
    return (
      <Box sx={{ maxWidth: 400 }}>
        <Stepper activeStep={currentStepIndex} orientation="vertical">
          {workflowSteps.map((step, index) => {
            const workflowEntry = getWorkflowEntryForStatus(step.status);
            const stepStatus = getStepStatus(index);
            
            return (
              <Step key={step.status}>
                <StepLabel
                  icon={step.icon}
                  sx={{
                    '& .MuiStepIcon-root': {
                      color: stepStatus === 'completed' ? 'success.main' : 
                             stepStatus === 'active' ? 'primary.main' : 'grey.300',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {step.label}
                    </Typography>
                    {stepStatus === 'active' && (
                      <Chip label="Current" size="small" color="primary" />
                    )}
                  </Box>
                </StepLabel>
                
                {showDetails && (
                  <StepContent>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {step.description}
                    </Typography>
                    
                    {workflowEntry && (
                      <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                        <Typography variant="caption" color="text.secondary">
                          {workflowEntry.action} by {workflowEntry.actionBy}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {new Date(workflowEntry.timestamp).toLocaleString()}
                        </Typography>
                        {workflowEntry.comments && (
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            "{workflowEntry.comments}"
                          </Typography>
                        )}
                      </Paper>
                    )}
                  </StepContent>
                )}
              </Step>
            );
          })}
        </Stepper>
      </Box>
    );
  }

  // Horizontal layout
  return (
    <Box sx={{ width: '100%' }}>
      <Stepper activeStep={currentStepIndex} alternativeLabel>
        {workflowSteps.map((step, index) => {
          const stepStatus = getStepStatus(index);
          
          return (
            <Step key={step.status}>
              <StepLabel
                icon={step.icon}
                sx={{
                  '& .MuiStepIcon-root': {
                    color: stepStatus === 'completed' ? 'success.main' : 
                           stepStatus === 'active' ? 'primary.main' : 'grey.300',
                  },
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {step.label}
                </Typography>
                {stepStatus === 'active' && (
                  <Chip label="Current" size="small" color="primary" sx={{ mt: 0.5 }} />
                )}
              </StepLabel>
            </Step>
          );
        })}
      </Stepper>
      
      {showDetails && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {workflowSteps[currentStepIndex]?.description}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default WorkflowProgressTracker;