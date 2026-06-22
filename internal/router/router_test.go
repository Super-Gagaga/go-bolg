package router

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/yourname/go-bolg/internal/config"
	"go.uber.org/zap"
)

func TestBaseRoutes(t *testing.T) {
	engine := New(&config.Config{}, nil, nil, zap.NewNop())

	tests := []struct {
		name string
		path string
	}{
		{name: "home page", path: "/"},
		{name: "index page", path: "/index.html"},
		{name: "index css", path: "/css/index.css"},
		{name: "index js", path: "/js/index.js"},
		{name: "health", path: "/health"},
		{name: "ping", path: "/api/v1/ping"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			rec := httptest.NewRecorder()

			engine.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
			}
		})
	}
}
