package service

import (
	"context"
	"errors"
	"strings"

	"github.com/yourname/go-bolg/internal/model"
	"github.com/yourname/go-bolg/internal/repository"
)

var (
	ErrInvalidUserStatus = errors.New("invalid user status")
	ErrInvalidUserRole   = errors.New("invalid user role")
)

type AdminService struct {
	users *repository.UserRepository
}

type UpdateUserStatusReq struct {
	Status string `json:"status" binding:"required,oneof=active banned"`
}

type UpdateUserRoleReq struct {
	Role string `json:"role" binding:"required,oneof=user admin"`
}

func NewAdminService(users *repository.UserRepository) *AdminService {
	return &AdminService{users: users}
}

func (s *AdminService) ListUsers(ctx context.Context, page, pageSize int, keyword string) (*model.PageResult, error) {
	users, total, err := s.users.List(page, pageSize, strings.TrimSpace(keyword))
	if err != nil {
		return nil, err
	}
	return &model.PageResult{List: users, Pagination: model.NewPagination(page, pageSize, total)}, nil
}

func (s *AdminService) UpdateUserStatus(ctx context.Context, userID int64, status string) error {
	if status != "active" && status != "banned" {
		return ErrInvalidUserStatus
	}
	return s.users.UpdateStatus(userID, status)
}

func (s *AdminService) UpdateUserRole(ctx context.Context, userID int64, role string) error {
	if role != "user" && role != "admin" {
		return ErrInvalidUserRole
	}
	return s.users.UpdateRole(userID, role)
}
