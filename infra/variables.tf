variable "cloudflare_api_token" {
  description = "Cloudflare API token with permissions for D1, R2, DNS, and Workers routes."
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account id."
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone id for uuid.social after the domain is added to Cloudflare."
  type        = string
}
