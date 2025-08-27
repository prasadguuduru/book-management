// Review store using Zustand
import { create } from 'zustand';
import { Review, CreateReviewRequest } from '@/types';
import { apiService } from '@/services/api';

interface ReviewState {
  reviews: Review[];
  isLoading: boolean;
  error: string | null;
}

interface ReviewActions {
  fetchBookReviews: (bookId: string) => Promise<void>;
  createReview: (reviewData: CreateReviewRequest) => Promise<Review>;
  updateReview: (
    reviewId: string,
    reviewData: Partial<CreateReviewRequest>
  ) => Promise<Review>;
  deleteReview: (reviewId: string) => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

type ReviewStore = ReviewState & ReviewActions;

export const useReviewStore = create<ReviewStore>((set: any) => ({
  // Initial state
  reviews: [],
  isLoading: false,
  error: null,

  // Actions
  fetchBookReviews: async (bookId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await apiService.getBookReviews(bookId);
      set({ reviews: response.items, isLoading: false });
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to fetch reviews',
        isLoading: false,
      });
    }
  },

  createReview: async (reviewData: CreateReviewRequest) => {
    set({ isLoading: true, error: null });

    try {
      const newReview = await apiService.createReview(reviewData);

      // Add to reviews list
      set((state: ReviewState) => ({
        reviews: [newReview, ...state.reviews],
        isLoading: false,
      }));

      return newReview;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create review';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  updateReview: async (
    reviewId: string,
    reviewData: Partial<CreateReviewRequest>
  ) => {
    set({ isLoading: true, error: null });

    try {
      const updatedReview = await apiService.updateReview(reviewId, reviewData);

      // Update in reviews list
      set((state: ReviewState) => ({
        reviews: state.reviews.map((review: Review) =>
          review.reviewId === reviewId ? updatedReview : review
        ),
        isLoading: false,
      }));

      return updatedReview;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update review';
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  deleteReview: async (reviewId: string) => {
    set({ isLoading: true, error: null });

    try {
      await apiService.deleteReview(reviewId);

      // Remove from reviews list
      set((state: ReviewState) => ({
        reviews: state.reviews.filter(
          (review: Review) => review.reviewId !== reviewId
        ),
        isLoading: false,
      }));
    } catch (error) {
      set({
        error:
          error instanceof Error ? error.message : 'Failed to delete review',
        isLoading: false,
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));
