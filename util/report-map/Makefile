TARGETFILE = ../../damast/reporting/map-data/features.geo.json.gz
GEOJSON = $(notdir $(TARGETFILE:.gz=))
LOD = 10m
FEATURES = ocean lakes rivers_lake_centerlines
LOCALFILES = $(addprefix ne_$(LOD)_, $(addsuffix .json, $(FEATURES)))

all: $(TARGETFILE)

$(LOCALFILES):
	wget https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/$(LOD)/physical/$@

$(GEOJSON): $(LOCALFILES) process.py
	source env/bin/activate \
		&& python ./process.py $(LOD)

$(TARGETFILE): $(GEOJSON)
	mkdir -p $(dir $@)
	gzip -9c $< > $@
