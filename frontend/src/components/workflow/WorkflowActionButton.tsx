import React, { useState } from 'react';
import {
  Button,
  IconButton,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import {
  Send as SubmitIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  Publish as PublishIcon,
} from '@mui/icons-material';
import { Book } from '@/types';

interface WorkflowActionButtonProps {
  action: 'submit' | 'approve' | 'reject' | 'publish';
  book: Book;
  onAction: (bookId: string, comments?: string) => Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'button' | 'icon';
  showConfirmDialog?: boolean;
}

const actionConfig = {
  submit: {
    label: 'Submit for Editing',
    icon: <SubmitIcon />,
    color: 'primary' as const,
    confirmTitle: 'Submit Book for Editing',
    confirmMessage: 'Are you sure you want to submit this book for editing? Once submitted, you won\'t be able to edit it until it\'s reviewed.',
    requiresComments: false,
    successMessage: 'Book submitted for editing successfully!',
  },
  approve: {
    label: 'Approve',
    icon: <ApproveIcon />,
    color: 'success' as const,
    confirmTitle: 'Approve Book',
    confirmMessage: 'Are you sure you want to approve this book? It will be moved to ready for publication.',
    requiresComments: false,
    successMessage: 'Book approved successfully!',
  },
  reject: {
    label: 'Reject',
    icon: <RejectIcon />,
    color: 'error' as const,
    confirmTitle: 'Reject Book',
    confirmMessage: 'Please provide feedback for rejecting this book. The author will see your comments.',
    requiresComments: true,
    successMessage: 'Book rejected and returned to author.',
  },
  publish: {
    label: 'Publish',
    icon: <PublishIcon />,
    color: 'success' as const,
    confirmTitle: 'Publish Book',
    confirmMessage: 'Are you sure you want to publish this book? Once published, it will be available to all readers.',
    requiresComments: false,
    successMessage: 'Book published successfully!',
  },
};

const WorkflowActionButton: React.FC<WorkflowActionButtonProps> = ({
  action,
  book,
  onAction,
  disabled = false,
  loading = false,
  size = 'medium',
  variant = 'button',
  showConfirmDialog = true,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = actionConfig[action];

  const handleClick = () => {
    if (showConfirmDialog) {
      setIsDialogOpen(true);
      setError(null);
    } else {
      handleAction();
    }
  };

  const handleAction = async () => {
    if (config.requiresComments && !comments.trim()) {
      setError('Comments are required for this action');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onAction(book.bookId, comments.trim() || undefined);
      setIsDialogOpen(false);
      setComments('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setComments('');
    setError(null);
  };

  const buttonProps = {
    disabled: disabled || loading,
    color: config.color,
    onClick: handleClick,
  };

  const ButtonComponent = variant === 'icon' ? (
    <IconButton
      {...buttonProps}
      size={size}
      title={config.label}
    >
      {loading ? <CircularProgress size={20} /> : config.icon}
    </IconButton>
  ) : (
    <Button
      {...buttonProps}
      variant="contained"
      size={size}
      startIcon={loading ? <CircularProgress size={16} /> : config.icon}
    >
      {loading ? 'Processing...' : config.label}
    </Button>
  );

  return (
    <>
      {ButtonComponent}

      <Dialog
        open={isDialogOpen}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{config.confirmTitle}</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            {config.confirmMessage}
          </Typography>

          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
            <Typography variant="body2">
              <strong>Book:</strong> {book.title}
            </Typography>
            <Typography variant="body2">
              <strong>Current Status:</strong> {book.status}
            </Typography>
          </Box>

          {config.requiresComments && (
            <TextField
              fullWidth
              label="Comments *"
              multiline
              rows={4}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              margin="normal"
              required
              placeholder={
                action === 'reject' 
                  ? 'Explain what needs to be improved...'
                  : 'Add any comments or feedback...'
              }
              error={!!error && !comments.trim()}
              helperText={error && !comments.trim() ? 'Comments are required' : ''}
            />
          )}

          {!config.requiresComments && (
            <TextField
              fullWidth
              label="Comments (optional)"
              multiline
              rows={3}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              margin="normal"
              placeholder="Add any comments or feedback..."
            />
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleAction}
            variant="contained"
            color={config.color}
            disabled={isSubmitting || (config.requiresComments && !comments.trim())}
            startIcon={isSubmitting ? <CircularProgress size={16} /> : config.icon}
          >
            {isSubmitting ? 'Processing...' : config.label}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default WorkflowActionButton;