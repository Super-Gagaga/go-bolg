package service

import (
	"context"
	"encoding/json"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/yourname/go-bolg/internal/repository"
)

const (
	recommendedAuthorsCacheKey = "recommendations:authors"
	trendingTagsCacheKey       = "topics:trending"
	recommendationCacheTTL     = 10 * time.Minute
)

type RecommendationService struct {
	repo  *repository.RecommendationRepository
	redis *redis.Client
}

func NewRecommendationService(repo *repository.RecommendationRepository, redis *redis.Client) *RecommendationService {
	return &RecommendationService{repo: repo, redis: redis}
}

func (s *RecommendationService) GetRecommendedAuthors(ctx context.Context, limit int) ([]repository.RecommendedAuthor, error) {
	if cached, ok := s.getAuthorsCache(ctx); ok {
		return cached, nil
	}

	authors, err := s.repo.GetRecommendedAuthors(limit)
	if err != nil {
		return nil, err
	}
	s.setAuthorsCache(ctx, authors)
	return authors, nil
}

func (s *RecommendationService) GetTrendingTags(ctx context.Context, limit int) ([]repository.TrendingTag, error) {
	if cached, ok := s.getTagsCache(ctx); ok {
		return cached, nil
	}

	tags, err := s.repo.GetTrendingTags(limit)
	if err != nil {
		return nil, err
	}
	s.setTagsCache(ctx, tags)
	return tags, nil
}

func (s *RecommendationService) getAuthorsCache(ctx context.Context) ([]repository.RecommendedAuthor, bool) {
	if s.redis == nil {
		return nil, false
	}
	raw, err := s.redis.Get(ctx, recommendedAuthorsCacheKey).Bytes()
	if err != nil {
		return nil, false
	}
	var authors []repository.RecommendedAuthor
	if err := json.Unmarshal(raw, &authors); err != nil {
		return nil, false
	}
	return authors, true
}

func (s *RecommendationService) setAuthorsCache(ctx context.Context, authors []repository.RecommendedAuthor) {
	if s.redis == nil {
		return
	}
	payload, err := json.Marshal(authors)
	if err != nil {
		return
	}
	_ = s.redis.Set(ctx, recommendedAuthorsCacheKey, payload, recommendationCacheTTL).Err()
}

func (s *RecommendationService) getTagsCache(ctx context.Context) ([]repository.TrendingTag, bool) {
	if s.redis == nil {
		return nil, false
	}
	raw, err := s.redis.Get(ctx, trendingTagsCacheKey).Bytes()
	if err != nil {
		return nil, false
	}
	var tags []repository.TrendingTag
	if err := json.Unmarshal(raw, &tags); err != nil {
		return nil, false
	}
	return tags, true
}

func (s *RecommendationService) setTagsCache(ctx context.Context, tags []repository.TrendingTag) {
	if s.redis == nil {
		return
	}
	payload, err := json.Marshal(tags)
	if err != nil {
		return
	}
	_ = s.redis.Set(ctx, trendingTagsCacheKey, payload, recommendationCacheTTL).Err()
}
