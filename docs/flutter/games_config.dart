/// Copy into your Flutter app — game URLs for WebView embedding.
class GamesConfig {
  GamesConfig({required this.baseUrl, required this.operatorToken});

  final String baseUrl;
  final String operatorToken;

  static const games = <String, String>{
    'olympus-rise': 'Olympus Rise',
    'greedy-feast': 'Greedy Feast',
    'luck-77': 'Luck 77',
    'dice-duel': 'Dice Duel',
    'goal-clash': 'Goal Clash',
    'rocket-rush': 'Rocket Rush',
  };

  /// Dev: direct WebView URL with token + player id from your auth.
  String playUrl(String slug, String playerId) {
    return '$baseUrl/play/$slug?token=$operatorToken&player=${Uri.encodeComponent(playerId)}';
  }

  /// Prod: fetch signed launch URL from game server first.
  Uri launchApi(String slug, String playerId) {
    return Uri.parse('$baseUrl/api/v1/launch').replace(queryParameters: {
      'token': operatorToken,
      'player': playerId,
      'game': slug,
    });
  }
}
