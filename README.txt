Pick modular package v5.7.34 modular

Files:
- index.html
- styles.css
- js/config.js
- js/utils.js
- js/diagnostics.js
- js/parser.js
- js/connectors/espn.js
- js/connectors/nba.js
- js/connectors/injuries.js
- js/connectors/search.js
- js/factors/nba.js
- js/app.js

Notes:
- Main HTML is now smaller and modular.
- Paused factors are inactive.
- 3PTM ingest was tested locally with the sample 'Desmond Bane...1.5 3PTM'.
- Connectors are separated so working files can be frozen later.


Flattened root package with renamed modules:
- app_main.js
- config_core.js
- utils_core.js
- parser_intake.js
- diagnostics.js
- connector_espn.js
- connector_nba.js
- connector_injuries.js
- connector_search.js
- factor_nba.js
