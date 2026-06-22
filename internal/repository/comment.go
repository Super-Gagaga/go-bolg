package repository

import (
	"errors"

	"github.com/yourname/go-bolg/internal/model"
	"gorm.io/gorm"
)

type CommentRepository struct {
	db *gorm.DB
}

func NewCommentRepository(db *gorm.DB) *CommentRepository {
	return &CommentRepository{db: db}
}

func (r *CommentRepository) Create(comment *model.Comment) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(comment).Error; err != nil {
			return err
		}
		return tx.Model(&model.Article{}).
			Where("id = ?", comment.ArticleID).
			UpdateColumn("comment_count", gorm.Expr("comment_count + ?", 1)).
			Error
	})
}

func (r *CommentRepository) FindByID(id int64) (*model.Comment, error) {
	var comment model.Comment
	err := r.db.Preload("User").First(&comment, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &comment, err
}

func (r *CommentRepository) FindByArticleID(articleID int64) ([]model.Comment, error) {
	var comments []model.Comment
	err := r.db.
		Unscoped().
		Preload("User").
		Where("article_id = ?", articleID).
		Order("created_at ASC").
		Find(&comments).Error
	return comments, err
}

func (r *CommentRepository) SoftDelete(commentID int64) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var comment model.Comment
		if err := tx.First(&comment, commentID).Error; err != nil {
			return err
		}
		if err := tx.Delete(&comment).Error; err != nil {
			return err
		}
		return tx.Model(&model.Article{}).
			Where("id = ? AND comment_count > 0", comment.ArticleID).
			UpdateColumn("comment_count", gorm.Expr("comment_count - ?", 1)).
			Error
	})
}
