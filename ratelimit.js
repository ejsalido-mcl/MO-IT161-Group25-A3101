// ============================================
// NetGuard — tiny in-memory rate limiter
// Stops password guessing on /login and spam on the public forms.
// (Resets when the server restarts. Fine for a school project;
//  a real deployment would use a shared store.)
// ============================================

function createRateLimiter({ windowMs, max, now = Date.now }) {
    const hits = new Map(); // ip -> list of request times (ms)

    return function rateLimit(req, res, next) {
        const key = req.ip || "unknown";
        const time = now();

        // Forget requests that are older than the window
        const recent = (hits.get(key) || []).filter((t) => time - t < windowMs);

        if (recent.length >= max) {
            hits.set(key, recent);
            const retryAfter = Math.max(1, Math.ceil((recent[0] + windowMs - time) / 1000));
            res.set("Retry-After", String(retryAfter));
            return res.status(429).json({ error: "Too many requests. Please try again later." });
        }

        recent.push(time);
        hits.set(key, recent);

        // Keep memory small: drop addresses that have gone quiet
        if (hits.size > 5000) {
            for (const [ip, times] of hits) {
                if (times.every((t) => time - t >= windowMs)) hits.delete(ip);
            }
        }

        next();
    };
}

module.exports = { createRateLimiter };
