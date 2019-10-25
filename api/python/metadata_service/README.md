# Metadata Query Code Samples


## Table structures

The underlying technology is Athena. There are two views that can be queried:

1. Manifests themselves
    - `quilt_metadata_service_manifests`
    - How many versions are there of this package?
    - List all versions of this package.
    - Find all versions of this package created in the last two days
2. Entries in manifests  
    - `quilt_metadata_service_entries`
    - How many entries are there in this version of this package?
    - Calculate total size of all objects in this version of this package
    - Look at file type breakdown in this package

   __You may want to combine the two tables. This is a valuable but more expensive operation exposed via a third view:__

3. Entries along with which manifest they are in
    - `quilt_metadata_service_combined`
    - Which version of this package contain this s3 object+version?
    - What is the average number of keys across version of this package?
    
The underlying data is partitioned by `package` and by the first few characters of the `tophash` so you can leverage that to improve query speed.
    
## Usage

You can use the metadata tables in any way that you can consume Athena with the [`pyathena`](https://github.com/laughingman7743/PyAthena) library. We provide a couple utilities to make this easy.

1. Raw SQL
2. Structured SQL (convenience tool for writing raw SQL that automatically leverages partitioning to improve performance)
3. SQLAlchemy engine
4. The `pyathena.Connection` object is exposed, which is [Python DB API 2.0 (PEP 249)](https://www.python.org/dev/peps/pep-0249) compliant.

Between the SQLAlchemy engine and the DBAPI2.0 compliant connection, you will be able to query metadata from many other clients, for example `pandas.read_sql`.

### Raw SQL

```python
from quilt3 import MetadataQuery

rows = MetadataQuery(bucket='quilt-ml-data').raw_sql("""\
SELECT logical_key
   , physical_key
   , size
   , object_hash_type
   , object_hash
   , package
   , manifest_commit_message
   , hash 
   , meta -- user defined metadata for each logical_key (work with meta using Presto JSON tools)
FROM "default"."quilt_metadata_service_combined" limit 10;
""").execute()
```

Presto JSON tools: https://prestodb.github.io/docs/current/functions/json.html

### Structured SQL

```python
from quilt3 import MetadataQuery

rows = MetadataQuery(
                        bucket="quilt-ml-data",
                        table="quilt_metadata_service_combined",
                        package="mypackage", 
                        tophash="84be4b8df0a35ce7a85c08d9a506ca3bfa430aca00fcab9650dc25ac1f37c0a9"
                     ).select([
                        "logical_key",
                        "physical_key",
                        "size",
                        "object_hash_type",
                        "object_hash",
                        "package", # Package name
                        "manifest_commit_message", 
                        "hash" # manifest top hash
                        "meta" # user defined metadata for each logical_key (work with meta using Presto JSON tools)
                    ]).where([
                        "'size' > 1000000"
                    ]).limit(
                        100
                    ).execute()
```
Note `table`, `package` and `tophash` are optional, but if you pass one or more of them in, `MetadataQuery` can automatically leverage Athena partitioning to execute a more performant query.

### SQLAlchemy


```python
from quilt3 import MetadataQuery
from sqlalchemy.sql.schema import Table, MetaData

engine = MetadataQuery(bucket='quilt-ml-data').sqlalchemy_engine
table = Table('quilt_metadata_service_combined', MetaData(bind=engine), autoload=True)
results = table.select().limit(100).execute()
for row in results:
    print(row)
```

### pandas read_sql

```python
from quilt3 import MetadataQuery
import pandas as pd


df = pd.read_sql("""
SELECT logical_key
   , physical_key
   , size
   , object_hash_type
   , object_hash
   , package -- Package name
   , manifest_commit_message
   , hash -- manifest top hash
   , meta -- user defined metadata for each logical_key (work with meta using Presto JSON tools)
FROM "default"."quilt_metadata_service_combined" limit 10;
""", con=MetadataQuery(bucket='quilt-ml-data').pyathena_connection)

print(df.head())
```