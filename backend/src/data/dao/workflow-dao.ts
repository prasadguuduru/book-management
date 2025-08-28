/**
 * Workflow Data Access Object for book state transitions
 */

// import { v4 as uuidv4 } from 'uuid'; // Not used in this file
import { dynamoDBClient } from '../dynamodb-client';
import { logger } from '../../utils/logger';
import { WorkflowEntry, WorkflowAction, BookStatus, UserRole } from '../../types';

export interface WorkflowEntity {
  PK: `WORKFLOW#${string}`;
  SK: string; // ISO timestamp
  entityType: 'WORKFLOW';
  bookId: string;
  fromState: BookStatus | null;
  toState: BookStatus;
  actionBy: string;
  action: WorkflowAction;
  comments?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export class WorkflowDAO {
  private client = dynamoDBClient;

  /**
   * Record a workflow transition
   */
  async recordTransition(
    bookId: string,
    fromState: BookStatus | null,
    toState: BookStatus,
    actionBy: string,
    action: WorkflowAction,
    comments?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    
    const workflowEntity: WorkflowEntity = {
      PK: `WORKFLOW#${bookId}`,
      SK: timestamp,
      entityType: 'WORKFLOW',
      bookId,
      fromState,
      toState,
      actionBy,
      action,
      timestamp,
    };

    if (comments) {
      workflowEntity.comments = comments;
    }

    if (metadata) {
      workflowEntity.metadata = metadata;
    }

    try {
      await this.client.put(workflowEntity);
      
      logger.info('Workflow transition recorded', {
        bookId,
        fromState,
        toState,
        action,
        actionBy,
        timestamp
      });
    } catch (error) {
      logger.error('Error recording workflow transition:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get workflow history for a book
   */
  async getBookWorkflowHistory(
    bookId: string,
    limit: number = 50,
    lastEvaluatedKey?: any
  ): Promise<{ 
    history: WorkflowEntry[]; 
    lastEvaluatedKey?: any; 
    hasMore: boolean 
  }> {
    try {
      const result = await this.client.query(
        'PK = :pk',
        { ':pk': `WORKFLOW#${bookId}` },
        undefined,
        undefined,
        undefined,
        limit,
        lastEvaluatedKey,
        false // Most recent first
      );

      const history = result.items.map(item => this.entityToWorkflowEntry(item));

      return {
        history,
        lastEvaluatedKey: result.lastEvaluatedKey,
        hasMore: !!result.lastEvaluatedKey,
      };
    } catch (error) {
      logger.error('Error getting workflow history:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get recent workflow activities (across all books)
   */
  async getRecentWorkflowActivities(
    limit: number = 20
  ): Promise<WorkflowEntry[]> {
    try {
      // This would require a GSI on timestamp in production
      // For now, we'll use a scan with filter (less efficient)
      const result = await this.client.query(
        'begins_with(PK, :pk)',
        { ':pk': 'WORKFLOW#' },
        undefined,
        undefined,
        undefined,
        limit,
        undefined,
        false // Most recent first
      );

      return result.items
        .map(item => this.entityToWorkflowEntry(item))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (error) {
      logger.error('Error getting recent workflow activities:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get workflow statistics for a time period
   */
  async getWorkflowStatistics(
    startDate: string,
    endDate: string
  ): Promise<{
    totalTransitions: number;
    transitionsByAction: Record<WorkflowAction, number>;
    transitionsByStatus: Record<BookStatus, number>;
    averageTimeInStatus: Record<BookStatus, number>;
  }> {
    try {
      // This is a simplified implementation
      // In production, consider using DynamoDB Streams + Lambda for real-time aggregation
      const result = await this.client.query(
        'begins_with(PK, :pk) AND SK BETWEEN :start AND :end',
        { 
          ':pk': 'WORKFLOW#',
          ':start': startDate,
          ':end': endDate
        }
      );

      const transitions = result.items.map(item => this.entityToWorkflowEntry(item));
      
      const stats = {
        totalTransitions: transitions.length,
        transitionsByAction: {} as Record<WorkflowAction, number>,
        transitionsByStatus: {} as Record<BookStatus, number>,
        averageTimeInStatus: {} as Record<BookStatus, number>,
      };

      // Count transitions by action
      transitions.forEach(transition => {
        stats.transitionsByAction[transition.action] = 
          (stats.transitionsByAction[transition.action] || 0) + 1;
        
        stats.transitionsByStatus[transition.toState] = 
          (stats.transitionsByStatus[transition.toState] || 0) + 1;
      });

      // Calculate average time in status (simplified)
      const statusTimes: Record<BookStatus, number[]> = {} as any;
      const bookTransitions: Record<string, WorkflowEntry[]> = {};

      // Group transitions by book
      transitions.forEach(transition => {
        if (!bookTransitions[transition.bookId]) {
          bookTransitions[transition.bookId] = [];
        }
        bookTransitions[transition.bookId]!.push(transition);
      });

      // Calculate time spent in each status
      Object.values(bookTransitions).forEach(bookHistory => {
        bookHistory.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        for (let i = 0; i < bookHistory.length - 1; i++) {
          const current = bookHistory[i];
          const next = bookHistory[i + 1];
          
          if (current && next) {
            const timeInStatus = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
            
            if (!statusTimes[current.toState]) {
              statusTimes[current.toState] = [];
            }
            statusTimes[current.toState]!.push(timeInStatus);
          }
        }
      });

      // Calculate averages
      Object.entries(statusTimes).forEach(([status, times]) => {
        const average = times.reduce((sum, time) => sum + time, 0) / times.length;
        stats.averageTimeInStatus[status as BookStatus] = Math.round(average / (1000 * 60 * 60 * 24)); // Convert to days
      });

      return stats;
    } catch (error) {
      logger.error('Error getting workflow statistics:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get books pending action for a user role
   */
  async getBooksRequiringAction(
    userRole: UserRole,
    limit: number = 20
  ): Promise<string[]> {
    try {
      // This would be more efficient with proper GSI design
      // For now, we'll return books based on their current status that require action from this role
      const statusesRequiringAction: Record<UserRole, BookStatus[]> = {
        AUTHOR: [], // Authors don't have pending actions from workflow perspective
        EDITOR: ['SUBMITTED_FOR_EDITING'],
        PUBLISHER: ['READY_FOR_PUBLICATION'],
        READER: [], // Readers don't have workflow actions
      };

      const statuses = statusesRequiringAction[userRole];
      if (!statuses.length) {
        return [];
      }

      // This is a simplified implementation
      // In production, maintain a separate index for pending actions
      const bookIds: string[] = [];
      
      for (const status of statuses) {
        const result = await this.client.query(
          'begins_with(PK, :pk)',
          { ':pk': 'WORKFLOW#' },
          undefined,
          undefined,
          undefined,
          limit
        );

        // Get unique book IDs that are currently in the required status
        const recentTransitions = result.items
          .map(item => this.entityToWorkflowEntry(item))
          .filter(transition => transition.toState === status);

        recentTransitions.forEach(transition => {
          if (!bookIds.includes(transition.bookId)) {
            bookIds.push(transition.bookId);
          }
        });
      }

      return bookIds.slice(0, limit);
    } catch (error) {
      logger.error('Error getting books requiring action:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Check if a book has pending workflow actions
   */
  async hasPendingActions(bookId: string): Promise<boolean> {
    try {
      const result = await this.client.query(
        'PK = :pk',
        { ':pk': `WORKFLOW#${bookId}` },
        undefined,
        undefined,
        undefined,
        1,
        undefined,
        false // Most recent first
      );

      if (result.items.length === 0) {
        return false;
      }

      const lastTransition = this.entityToWorkflowEntry(result.items[0]);
      
      // Check if the book is in a state that requires action
      const pendingStates: BookStatus[] = ['SUBMITTED_FOR_EDITING', 'READY_FOR_PUBLICATION'];
      return pendingStates.includes(lastTransition.toState);
    } catch (error) {
      logger.error('Error checking pending actions:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Get workflow summary for a book
   */
  async getBookWorkflowSummary(bookId: string): Promise<{
    currentStatus: BookStatus | null;
    totalTransitions: number;
    createdAt: string | null;
    lastUpdated: string | null;
    timeInCurrentStatus: number; // days
  }> {
    try {
      const result = await this.client.query(
        'PK = :pk',
        { ':pk': `WORKFLOW#${bookId}` },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false // Most recent first
      );

      const transitions = result.items.map(item => this.entityToWorkflowEntry(item));
      
      if (transitions.length === 0) {
        return {
          currentStatus: null,
          totalTransitions: 0,
          createdAt: null,
          lastUpdated: null,
          timeInCurrentStatus: 0,
        };
      }

      const sortedTransitions = transitions.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const firstTransition = sortedTransitions[0]!;
      const lastTransition = sortedTransitions[sortedTransitions.length - 1]!;
      
      const timeInCurrentStatus = Math.round(
        (Date.now() - new Date(lastTransition.timestamp).getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        currentStatus: lastTransition.toState,
        totalTransitions: transitions.length,
        createdAt: firstTransition.timestamp,
        lastUpdated: lastTransition.timestamp,
        timeInCurrentStatus,
      };
    } catch (error) {
      logger.error('Error getting workflow summary:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Convert DynamoDB entity to WorkflowEntry
   */
  private entityToWorkflowEntry(entity: any): WorkflowEntry {
    return {
      bookId: entity.bookId,
      fromState: entity.fromState,
      toState: entity.toState,
      actionBy: entity.actionBy,
      action: entity.action,
      comments: entity.comments,
      metadata: entity.metadata,
      timestamp: entity.timestamp,
    };
  }

  /**
   * Validate workflow action
   */
  validateWorkflowAction(
    action: WorkflowAction,
    fromState: BookStatus | null,
    toState: BookStatus
  ): boolean {
    const validTransitions: Record<WorkflowAction, { from: (BookStatus | null)[]; to: BookStatus[] }> = {
      CREATE: { from: [null], to: ['DRAFT'] },
      SUBMIT: { from: ['DRAFT'], to: ['SUBMITTED_FOR_EDITING'] },
      APPROVE: { from: ['SUBMITTED_FOR_EDITING'], to: ['READY_FOR_PUBLICATION'] },
      REJECT: { from: ['SUBMITTED_FOR_EDITING', 'READY_FOR_PUBLICATION'], to: ['DRAFT'] },
      PUBLISH: { from: ['READY_FOR_PUBLICATION'], to: ['PUBLISHED'] },
    };

    const transition = validTransitions[action];
    if (!transition) {
      return false;
    }

    return transition.from.includes(fromState) && transition.to.includes(toState);
  }

  /**
   * Get action display name
   */
  getActionDisplayName(action: WorkflowAction): string {
    const displayNames: Record<WorkflowAction, string> = {
      CREATE: 'Created',
      SUBMIT: 'Submitted for Editing',
      APPROVE: 'Approved for Publication',
      REJECT: 'Rejected',
      PUBLISH: 'Published',
    };

    return displayNames[action] || action;
  }
}

// Singleton instance
export const workflowDAO = new WorkflowDAO();