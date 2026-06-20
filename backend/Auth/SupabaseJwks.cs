using Microsoft.IdentityModel.Tokens;

namespace RecrutaBot.Api.Auth;

/// <summary>
/// Fetches and caches the Supabase project's JSON Web Key Set
/// (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`) for validating user JWTs.
/// Keys are refreshed periodically and on a kid miss (key rotation).
/// </summary>
public sealed class SupabaseJwks
{
    private readonly HttpClient _http;
    private readonly string _jwksUrl;
    private readonly object _lock = new();
    private IList<SecurityKey> _keys = new List<SecurityKey>();
    private DateTimeOffset _expires = DateTimeOffset.MinValue;

    public SupabaseJwks(HttpClient http, string supabaseUrl)
    {
        _http = http;
        _jwksUrl = supabaseUrl.TrimEnd('/') + "/auth/v1/.well-known/jwks.json";
    }

    /// <summary>Resolver compatible with JwtBearer's IssuerSigningKeyResolver.</summary>
    public IEnumerable<SecurityKey> ResolveKeys(string? kid)
    {
        EnsureFresh(kid);
        return _keys;
    }

    private void EnsureFresh(string? kid)
    {
        var now = DateTimeOffset.UtcNow;
        bool haveKid = kid is null || _keys.Any(k => string.Equals(k.KeyId, kid, StringComparison.Ordinal));
        if (now < _expires && haveKid) return;

        lock (_lock)
        {
            haveKid = kid is null || _keys.Any(k => string.Equals(k.KeyId, kid, StringComparison.Ordinal));
            if (DateTimeOffset.UtcNow < _expires && haveKid) return;
            try
            {
                var json = _http.GetStringAsync(_jwksUrl).GetAwaiter().GetResult();
                var set = new JsonWebKeySet(json);
                var keys = set.GetSigningKeys().ToList();
                if (keys.Count > 0)
                {
                    _keys = keys;
                    _expires = DateTimeOffset.UtcNow.AddMinutes(10);
                }
            }
            catch
            {
                // keep stale keys on transient failure; short backoff before retrying
                _expires = DateTimeOffset.UtcNow.AddSeconds(30);
            }
        }
    }
}
