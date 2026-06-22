package router

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/yourname/go-bolg/internal/config"
	"github.com/yourname/go-bolg/internal/handler"
	"github.com/yourname/go-bolg/internal/middleware"
	"github.com/yourname/go-bolg/internal/pkg/app"
	jwtpkg "github.com/yourname/go-bolg/internal/pkg/jwt"
	"github.com/yourname/go-bolg/internal/pkg/markdown"
	"github.com/yourname/go-bolg/internal/repository"
	"github.com/yourname/go-bolg/internal/service"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

func New(cfg *config.Config, db *gorm.DB, redisClient *redis.Client, logger *zap.Logger) *gin.Engine {
	r := gin.New()
	r.Use(middleware.Recovery(logger))
	r.Use(middleware.TraceID())
	r.Use(middleware.Logger(logger))
	r.Use(middleware.CORS())
	r.Use(middleware.RateLimit(redisClient, middleware.RateLimitConfig{
		Prefix: "api",
		Limit:  300,
	}))
	homePage := webFilePath("index.html")
	detailPage := webFilePath("article-detail.html")
	followingPage := webFilePath("following.html")
	notificationsPage := webFilePath("notifications.html")
	editorPage := webFilePath("editor.html")
	adminPage := webFilePath("admin.html")
	adminLoginPage := webFilePath("admin-login.html")
	r.Static("/uploads", "./uploads")
	r.Static("/css", webFilePath("css"))
	r.Static("/js", webFilePath("js"))
	r.Static("/lib", webFilePath("lib"))
	r.GET("/index.html", func(c *gin.Context) {
		serveHTML(c, homePage)
	})
	r.StaticFile("/article-detail.html", detailPage)
	r.StaticFile("/following.html", followingPage)
	r.StaticFile("/notifications.html", notificationsPage)
	r.StaticFile("/editor.html", editorPage)
	r.StaticFile("/admin.html", adminPage)
	r.StaticFile("/admin-login.html", adminLoginPage)
	r.GET("/blog-homepage.html", func(c *gin.Context) {
		c.Redirect(301, "/")
	})
	r.GET("/", func(c *gin.Context) {
		serveHTML(c, homePage)
	})

	jwtManager := jwtpkg.NewManager(cfg.JWT)
	userRepo := repository.NewUserRepository(db)
	articleRepo := repository.NewArticleRepository(db)
	categoryRepo := repository.NewCategoryRepository(db)
	tagRepo := repository.NewTagRepository(db)
	commentRepo := repository.NewCommentRepository(db)
	likeRepo := repository.NewLikeRepository(db)
	favoriteRepo := repository.NewFavoriteRepository(db)
	followRepo := repository.NewFollowRepository(db)
	notificationRepo := repository.NewNotificationRepository(db)
	feedRepo := repository.NewFeedRepository(db)
	recommendationRepo := repository.NewRecommendationRepository(db)
	statsRepo := repository.NewStatsRepository(db)
	auditLogRepo := repository.NewAuditLogRepository(db)

	userService := service.NewUserService(userRepo, redisClient, jwtManager, cfg)
	articleService := service.NewArticleService(articleRepo, categoryRepo, tagRepo, markdown.NewRenderer(), redisClient)
	categoryService := service.NewCategoryService(categoryRepo)
	tagService := service.NewTagService(tagRepo)
	notificationService := service.NewNotificationService(notificationRepo, userRepo, articleRepo, redisClient)
	adminService := service.NewAdminService(userRepo, articleRepo, commentRepo, statsRepo, auditLogRepo, notificationService, redisClient)
	commentService := service.NewCommentService(commentRepo, articleRepo, notificationService, redisClient)
	likeService := service.NewLikeService(likeRepo, articleRepo, notificationService, redisClient)
	favoriteService := service.NewFavoriteService(favoriteRepo, articleRepo, redisClient)
	followService := service.NewFollowService(followRepo, userRepo, notificationService, redisClient)
	feedService := service.NewFeedService(feedRepo, redisClient)
	recommendationService := service.NewRecommendationService(recommendationRepo, redisClient)

	userHandler := handler.NewUserHandler(userService)
	articleHandler := handler.NewArticleHandler(articleService)
	categoryHandler := handler.NewCategoryHandler(categoryService)
	tagHandler := handler.NewTagHandler(tagService)
	adminHandler := handler.NewAdminHandler(adminService)
	commentHandler := handler.NewCommentHandler(commentService)
	likeHandler := handler.NewLikeHandler(likeService)
	favoriteHandler := handler.NewFavoriteHandler(favoriteService)
	followHandler := handler.NewFollowHandler(followService)
	notificationHandler := handler.NewNotificationHandler(notificationService)
	feedHandler := handler.NewFeedHandler(feedService)
	recommendationHandler := handler.NewRecommendationHandler(recommendationService)
	homeHandler := handler.NewHomeHandler(articleService, categoryService, recommendationService)

	r.GET("/health", func(c *gin.Context) {
		app.Success(c, nil)
	})
	r.GET("/swagger/index.html", func(c *gin.Context) {
		app.SuccessMessage(c, "swagger docs are generated with `make swagger`", nil)
	})

	api := r.Group("/api/v1")
	{
		api.GET("/ping", func(c *gin.Context) {
			app.SuccessMessage(c, "pong", nil)
		})

		auth := api.Group("/auth")
		auth.Use(middleware.RateLimit(redisClient, middleware.RateLimitConfig{
			Prefix: "auth",
			Limit:  5,
		}))
		{
			auth.POST("/register", userHandler.Register)
			auth.POST("/login", userHandler.Login)
			auth.POST("/refresh", userHandler.Refresh)
		}

		user := api.Group("/user")
		{
			protected := user.Group("")
			protected.Use(middleware.Auth(jwtManager))
			{
				protected.GET("/profile", userHandler.GetProfile)
				protected.PUT("/profile", userHandler.UpdateProfile)
				protected.POST("/avatar", userHandler.UploadAvatar)
				protected.GET("/favorites", favoriteHandler.MyFavorites)
				protected.GET("/following", followHandler.Following)
				protected.GET("/followers", followHandler.Followers)
				protected.GET("/notifications", notificationHandler.List)
				protected.PATCH("/notifications/read", notificationHandler.MarkAsRead)
				protected.GET("/feed", feedHandler.UserFeed)
				protected.GET("/articles", articleHandler.MyArticles)
			}

			user.GET("/:id", userHandler.GetPublicProfile)
		}

		users := api.Group("/users")
		users.Use(middleware.Auth(jwtManager))
		{
			users.POST("/:id/follow", followHandler.Toggle)
		}

		admin := api.Group("/admin")
		admin.Use(middleware.Auth(jwtManager), middleware.Admin(userRepo))
		{
			admin.GET("/dashboard", adminHandler.GetDashboard)
			admin.GET("/users", adminHandler.ListUsers)
			admin.PATCH("/users/:id/status", adminHandler.UpdateUserStatus)
			admin.PATCH("/users/:id/role", adminHandler.UpdateUserRole)
			admin.GET("/articles/pending", adminHandler.ListPendingArticles)
			admin.POST("/articles/:id/approve", adminHandler.ApproveArticle)
			admin.POST("/articles/:id/reject", adminHandler.RejectArticle)
			admin.GET("/articles", adminHandler.ListArticles)
			admin.DELETE("/articles/:id", adminHandler.DeleteArticle)
			admin.GET("/comments", adminHandler.ListComments)
			admin.DELETE("/comments/:id", adminHandler.DeleteComment)
			admin.GET("/audit-logs", adminHandler.GetAuditLogs)

			admin.POST("/categories", categoryHandler.Create)
			admin.PUT("/categories/:id", categoryHandler.Update)
			admin.DELETE("/categories/:id", categoryHandler.Delete)

			admin.POST("/tags", tagHandler.Create)
			admin.PUT("/tags/:id", tagHandler.Update)
			admin.DELETE("/tags/:id", tagHandler.Delete)
		}

		articles := api.Group("/articles")
		{
			articles.GET("", articleHandler.List)
			articles.GET("/ranking", articleHandler.Ranking)
			articles.GET("/:id", articleHandler.Get)
			articles.GET("/:id/comments", commentHandler.ListByArticle)

			protected := articles.Group("")
			protected.Use(middleware.Auth(jwtManager))
			{
				protected.POST("", articleHandler.Create)
				protected.POST("/upload", articleHandler.UploadImage)
				protected.PUT("/:id", articleHandler.Update)
				protected.DELETE("/:id", articleHandler.Delete)
				protected.POST("/:id/upload", articleHandler.UploadImage)
				protected.PATCH("/:id/status", articleHandler.ChangeStatus)
				protected.POST("/:id/comments", commentHandler.Create)
				protected.POST("/:id/like", likeHandler.Toggle)
				protected.POST("/:id/favorite", favoriteHandler.Toggle)
			}
		}

		comments := api.Group("/comments")
		comments.Use(middleware.Auth(jwtManager))
		{
			comments.DELETE("/:id", commentHandler.Delete)
			comments.POST("/:id/reply", commentHandler.Reply)
		}

		categories := api.Group("/categories")
		{
			categories.GET("", categoryHandler.List)

			protected := categories.Group("")
			protected.Use(middleware.Auth(jwtManager))
			protected.POST("", categoryHandler.Create)
		}

		tags := api.Group("/tags")
		{
			tags.GET("", tagHandler.List)

			protected := tags.Group("")
			protected.Use(middleware.Auth(jwtManager))
			protected.POST("", tagHandler.Create)
		}

		recommendations := api.Group("/recommendations")
		{
			recommendations.GET("/authors", recommendationHandler.RecommendedAuthors)
		}

		topics := api.Group("/topics")
		{
			topics.GET("/trending", recommendationHandler.TrendingTopics)
		}

		api.GET("/home", homeHandler.Home)
	}

	return r
}

func webFilePath(name string) string {
	candidates := []string{
		filepath.Join("web", name),
		filepath.Join("..", "..", "web", name),
	}
	for _, candidate := range candidates {
		if _, err := os.Stat(candidate); err == nil {
			return candidate
		}
	}
	return filepath.Join("web", name)
}

func serveHTML(c *gin.Context, path string) {
	content, err := os.ReadFile(path)
	if err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	c.Data(http.StatusOK, "text/html; charset=utf-8", content)
}
