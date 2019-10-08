# Athena Queries

## DDL
### With severly reduced partitioning

```
CREATE EXTERNAL TABLE `manifest_refactor_test_2`(
  `logical_key` string, 
  `size` int,
  `physical_keys` string,
  `meta` string,
  `manifest_commit_message` string,
  `ts` timestamp,
  `package_hash` string,
  `object_hash` string
  )
PARTITIONED BY ( 
  `user` string, 
  `package` string)
ROW FORMAT SERDE 
  'org.openx.data.jsonserde.JsonSerDe' 
WITH SERDEPROPERTIES ( 
  'mapping.manifest_commit_message'='message',
  'mapping.object_hash'='hash') 
STORED AS INPUTFORMAT 
  'org.apache.hadoop.mapred.TextInputFormat' 
OUTPUTFORMAT 
  'org.apache.hadoop.hive.ql.io.IgnoreKeyTextOutputFormat'
LOCATION
  's3://armand-staging-t4/.quilt-test-2'
TBLPROPERTIES (
  'has_encrypted_data'='false')
```

## Generic Query of non-manifest metadata

```
SELECT logical_key
, size
, replace(replace(physical_keys, '["'), '"]') as "physical_key"
, meta
, "user"
, package
, package_hash
, ts
, object_hash
FROM "default"."manifest_refactor_test_2" 
WHERE logical_key IS NOT NULL
LIMIT 100
```

## Generic query of manifest metadata

```
SELECT package_hash
, manifest_commit_message
, ts
, "user"
, "package"
FROM "default"."manifest_refactor_test_2" 
WHERE logical_key IS NULL
```



## Specific queries

### Which package instances were created on/before/after DATE?

NOTE: This will be slow if there is no time-based partitioning

```
SELECT user, package, package_hash
FROM "default"."manifest_refactor_test_2" 
WHERE logical_key IS NULL
AND ts > from_iso8601_date('2019-01-01')
``` 

4 minutes. Not too bad given no time partitioning

### Which objects contain the following metadata (as JSON)?

```
SELECT *
FROM "default"."manifest_refactor_test_2" 
WHERE logical_key IS NOT NULL
AND json_extract_scalar(meta, '$.meta_field_4') = 'indigence'
```

(Run time: 3 minutes 56 seconds, Data scanned: 377.97 GB)

~ $0.38

### Which packages contain references to the following object@version_id?

```
SELECT *
, replace(replace(physical_keys, '["'), '"]') as "physical_key"
FROM "default"."manifest_refactor_test_2" 
WHERE logical_key IS NOT NULL
AND "physical_key" = 's3://armand-staging-t4/data/user1/pkg1/v229/8.parquet'
```

 (Run time: 3 minutes 29 seconds, Data scanned: 377.99 GB)
 
 ~ $0.38

### How many objects in a given packages instance? 

```
SELECT COUNT(*)
FROM "default"."manifest_refactor_test_2" 
WHERE logical_key IS NOT NULL
AND "user" = 'user0'
AND "package" = 'pkg0'
AND "package_hash" = '00QPe0PwPZDziGSShENcA9quki9s53'
```

### Total size of a given package instance?

```
SELECT SUM("size") as "total_size"
FROM "default"."manifest_refactor_test_2" 
WHERE logical_key IS NOT NULL
AND "user" = 'user0'
AND "package" = 'pkg0'
AND "package_hash" = '00QPe0PwPZDziGSShENcA9quki9s53'
```

### Which file extensions, and how many of each, are in this package? Bucket? 




### Retrieve all packages with a given Author after a given date.




