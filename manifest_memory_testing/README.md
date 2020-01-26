# Memory Usage of Various ManifestEntry Representations


```
REP=base
mprof run python test_memory.py $REP
mprof plot
mprof plot --flame
```

## `PackageEntryBase`
461secs to generate (primarily random string generation)
![memory plot](10M_PackageEntryBase.png)

## `PackageEntrySlots`
455 secs
![memory plot](10M_PackageEntrySlots.png)


## `tuple_package_entry`
461 secs
![memory plot](10M_PackageEntryTuple.png)


## `PackageEntryWithPhysicalKey`
477
![memory plot](10M_PackageEntryWithPhysicalKey.png)

## `PackageEntryWithPhysicalKeySlots`
457
![memory plot](10M_PackageEntryWithPhysicalKeySlots.png)

## `tuple_package_entry_with_physical_key`
474
![memory plot](10M_PackageEntryWithPhysicalKeyTuple.png)