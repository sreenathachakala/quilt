"""
Config file for dev. Overrides values in config.py.
"""

SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://root@localhost/quilt'
OAUTH = dict(
    base_url='https://quilt-heroku.herokuapp.com',
    client_id='chrOhbIPVtJAey7LcT1ez7PnIaV9tFLqNYXapcG3',
    client_secret=('ihhjjcPioqbdsNyo6xfjMmTALqsJzSLgVWd5SgPfAJ5gxRBUCjZR7jT8Yy2IJrVp' +
                   'Nbd0UHaKJHoBlFgjwwokTiaOEnmjGtS6KwaPDaXRb1jbrHkvpX82CNNAtwV44Nt3'),
)
