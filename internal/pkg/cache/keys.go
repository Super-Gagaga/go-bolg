package cache

import "fmt"

func ArticleLikeSetKey(articleID int64) string {
	return fmt.Sprintf("article:%d:likes", articleID)
}

func ArticleFavoriteSetKey(articleID int64) string {
	return fmt.Sprintf("article:%d:favorites", articleID)
}

func ArticleCommentCountKey(articleID int64) string {
	return fmt.Sprintf("article:%d:comment_count", articleID)
}

func ArticleDetailKey(articleID int64) string {
	return fmt.Sprintf("article:%d:detail", articleID)
}

func ArticleListKey(signature string) string {
	return fmt.Sprintf("articles:list:%s", signature)
}

func HotFeedKey() string {
	return "feed:hot"
}

func UserFollowingSetKey(userID int64) string {
	return fmt.Sprintf("user:%d:following", userID)
}

func UserFollowersSetKey(userID int64) string {
	return fmt.Sprintf("user:%d:followers", userID)
}

func UserUnreadNotificationsKey(userID int64) string {
	return fmt.Sprintf("user:%d:notifications:unread", userID)
}

func UserFeedKey(userID int64) string {
	return fmt.Sprintf("user:%d:feed", userID)
}
