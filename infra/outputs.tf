output "d1_database_id" {
  value = cloudflare_d1_database.app.id
}

output "r2_avatar_bucket_name" {
  value = cloudflare_r2_bucket.avatars.name
}

output "r2_media_bucket_name" {
  value = cloudflare_r2_bucket.media.name
}
