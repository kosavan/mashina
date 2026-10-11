# API v1
GET /notifications: authenticated own setup flags/public VAPID key, own push {id,label,active}, Telegram linked boolean and bot username, last20 deliveries {id,channel,state,updated,error_code,retry_at}; no endpoint/chat/code/private key.
POST /notifications/push {endpoint,keys:{auth,p256dh},label}: validate strict allowlist/keys, current consent,10-device cap; return ID. DELETE /notifications/push/{id}: own only.
POST /notifications/telegram/code: generate10-min one-time code if configured, shown once; hashed storage. DELETE /notifications/telegram: disconnect own binding/codes.
POST /notifications/deliveries/{id}/retry {acknowledge_duplicates:true}: own failed/uncertain, recheck due/access/channel, bounded attempts, resets ready; server timer sends later.
POST /notifications/push/current {endpoint} resolves own active device ID only. Logout accepts optional push_endpoint and removes that user/device binding atomically before deleting session. PATCH /notifications {enabled} toggles own consent; server restore pause is separate.
All mutations CSRF, no demo outbound. Auth401/403; invalid/config422; throttled/busy429. No request sends test messages. CLI default dryrun; --send for dispatch, --receive-links only explicit Bot API reading. Local notification-resume unpauses restored identity.
