package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yourname/go-bolg/internal/pkg/app"
	"github.com/yourname/go-bolg/internal/pkg/errcode"
	"github.com/yourname/go-bolg/internal/service"
)

type AdminHandler struct {
	admin *service.AdminService
}

func NewAdminHandler(admin *service.AdminService) *AdminHandler {
	return &AdminHandler{admin: admin}
}

func (h *AdminHandler) ListUsers(c *gin.Context) {
	result, err := h.admin.ListUsers(c.Request.Context(), queryInt(c, "page", 1), queryInt(c, "page_size", 10), c.Query("keyword"))
	if err != nil {
		app.Error(c, http.StatusInternalServerError, errcode.InternalServer, "")
		return
	}
	app.Success(c, result)
}

func (h *AdminHandler) UpdateUserStatus(c *gin.Context) {
	userID, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req service.UpdateUserStatusReq
	if err := c.ShouldBindJSON(&req); err != nil {
		app.Error(c, http.StatusBadRequest, errcode.InvalidParams, err.Error())
		return
	}
	if err := h.admin.UpdateUserStatus(c.Request.Context(), userID, req.Status); err != nil {
		writeAdminError(c, err)
		return
	}
	app.Success(c, nil)
}

func (h *AdminHandler) UpdateUserRole(c *gin.Context) {
	userID, ok := parseIDParam(c, "id")
	if !ok {
		return
	}
	var req service.UpdateUserRoleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		app.Error(c, http.StatusBadRequest, errcode.InvalidParams, err.Error())
		return
	}
	if err := h.admin.UpdateUserRole(c.Request.Context(), userID, req.Role); err != nil {
		writeAdminError(c, err)
		return
	}
	app.Success(c, nil)
}

func writeAdminError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrInvalidUserStatus), errors.Is(err, service.ErrInvalidUserRole):
		app.Error(c, http.StatusBadRequest, errcode.InvalidParams, err.Error())
	default:
		app.Error(c, http.StatusInternalServerError, errcode.InternalServer, "")
	}
}
