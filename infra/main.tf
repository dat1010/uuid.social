terraform {
  required_version = ">= 1.7.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

resource "cloudflare_d1_database" "app" {
  account_id = var.cloudflare_account_id
  name       = "uuid-social-db"
}

resource "cloudflare_r2_bucket" "avatars" {
  account_id = var.cloudflare_account_id
  name       = "uuid-social-avatars"
  location   = "WNAM"
}

resource "cloudflare_dns_record" "apex" {
  zone_id = var.cloudflare_zone_id
  name    = "uuid.social"
  type    = "AAAA"
  content = "100::"
  proxied = true
  ttl     = 1
}

resource "cloudflare_dns_record" "www" {
  zone_id = var.cloudflare_zone_id
  name    = "www"
  type    = "CNAME"
  content = "uuid.social"
  proxied = true
  ttl     = 1
}
