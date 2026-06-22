package service

import (
	"context"
	"errors"

	"github.com/redis/go-redis/v9"
	"github.com/yourname/go-bolg/internal/model"
	"github.com/yourname/go-bolg/internal/pkg/cache"
	"github.com/yourname/go-bolg/internal/repository"
)

var (
	ErrCannotFollowSelf   = errors.New("cannot follow yourself")
	ErrFollowUserNotFound = errors.New("follow user not found")
)

type FollowService struct {
	follows       *repository.FollowRepository
	users         *repository.UserRepository
	notifications *NotificationService
	redis         *redis.Client
}

func NewFollowService(follows *repository.FollowRepository, users *repository.UserRepository, notifications *NotificationService, redis *redis.Client) *FollowService {
	return &FollowService{follows: follows, users: users, notifications: notifications, redis: redis}
}

func (s *FollowService) ToggleFollow(ctx context.Context, followerID, followeeID int64) (bool, error) {
	if followerID == followeeID {
		return false, ErrCannotFollowSelf
	}
	followee, err := s.users.FindByID(followeeID)
	if err != nil {
		return false, err
	}
	if followee == nil {
		return false, ErrFollowUserNotFound
	}

	following, err := s.follows.Toggle(followerID, followeeID)
	if err != nil {
		return false, err
	}
	s.syncFollowCache(ctx, followerID, followeeID, following)
	if following && s.notifications != nil {
		s.notifications.SendNotification(ctx, followeeID, model.NotificationTypeFollow, map[string]interface{}{
			"follower_id": followerID,
		})
	}
	return following, nil
}

func (s *FollowService) GetFollowing(ctx context.Context, userID int64, page, pageSize int) (*model.PageResult, error) {
	follows, total, err := s.follows.ListFollowing(userID, page, pageSize)
	if err != nil {
		return nil, err
	}
	return &model.PageResult{List: follows, Pagination: model.NewPagination(page, pageSize, total)}, nil
}

func (s *FollowService) GetFollowers(ctx context.Context, userID int64, page, pageSize int) (*model.PageResult, error) {
	follows, total, err := s.follows.ListFollowers(userID, page, pageSize)
	if err != nil {
		return nil, err
	}
	return &model.PageResult{List: follows, Pagination: model.NewPagination(page, pageSize, total)}, nil
}

func (s *FollowService) syncFollowCache(ctx context.Context, followerID, followeeID int64, following bool) {
	if s.redis == nil {
		return
	}
	if following {
		_ = s.redis.SAdd(ctx, cache.UserFollowingSetKey(followerID), followeeID).Err()
		_ = s.redis.SAdd(ctx, cache.UserFollowersSetKey(followeeID), followerID).Err()
		return
	}
	_ = s.redis.SRem(ctx, cache.UserFollowingSetKey(followerID), followeeID).Err()
	_ = s.redis.SRem(ctx, cache.UserFollowersSetKey(followeeID), followerID).Err()
}
