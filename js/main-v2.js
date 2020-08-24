mapboxgl.accessToken = 'pk.eyJ1Ijoia29uc3RhbnRpbmJpcml1a292IiwiYSI6ImNrMWsxYjc1bjBrdjQzZHBiNTlhbjBqdmwifQ.vAlGhe7KTCajh5VvGfMJow';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/lobenichou/cjto9zfpj00jq1fs7gajbuaas?fresh=true',
    zoom: 3,
    center: [-90.1878, 38.6260]
});

const colors = ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd', '#ccebc5'];

const colorScale = d3.scaleOrdinal()
    .domain(["node", "cSharp", "go", "java", "ruby"])
    .range(colors);

// filters to define our categories using conditional logic
const node = ['==', ['get', 'lang'], 'Node'];
const cSharp = ['==', ['get', 'lang'], 'cSharp'];
const go = ['==', ['get', 'lang'], 'Go'];
const java = ['==', ['get', 'lang'], 'Java'];
const ruby = ['==', ['get', 'lang'], 'Ruby'];
const others = ['any'];

map.on('load', () => {
    // add a clustered GeoJSON source for progLanguages
    map.addSource('progLanguages', {
        'type': 'geojson',
        'data': progLanguages,
        'cluster': true, // to enable clustering to the source
        'clusterRadius': 100,
        'clusterProperties': { // keep separate counts for each lang category in a cluster,
            // defining the categories we want to keep track of; '+' returns the sum of the inputs,
            // 'case' selects the first output whose corresponding test condition evaluates to true, or the fallback value otherwise.
            'node': ['+', ['case', node, 1, 0]],
            'cSharp': ['+', ['case', cSharp, 1, 0]],
            'go': ['+', ['case', go, 1, 0]],
            'java': ['+', ['case', java, 1, 0]],
            'ruby': ['+', ['case', ruby, 1, 0]]
        }
    });

    map.addLayer({
        'id': 'progLanguages_individual',
        'type': 'circle',
        'source': 'progLanguages',
        'filter': ['!=', ['get', 'cluster'], true],
        'paint': {
            'circle-color': ['case',
                node, colorScale('node'),
                cSharp, colorScale('cSharp'),
                go, colorScale('go'),
                java, colorScale('java'),
                ruby, colorScale('ruby'),
                others, colorScale('others'), '#ffed6f'],
            'circle-radius': 5
        }
    });

    map.addLayer({
        'id': 'progLanguages_individual_outer',
        'type': 'circle',
        'source': 'progLanguages',
        'filter': ['!=', ['get', 'cluster'], true],
        'paint': {
            'circle-stroke-color': ['case',
                node, colorScale('node'),
                cSharp, colorScale('csharp'),
                go, colorScale('go'),
                java, colorScale('java'),
                ruby, colorScale('ruby'),
                others, colorScale('others'), '#ffed6f'],
            'circle-stroke-width': 2,
            'circle-radius': 10,
            'circle-color': "rgba(0, 0, 0, 0)"
        }
    });

    let markers = {};
    let markersOnScreen = {};
    let point_counts = [];
    let totals;

    const getPointCount = (features) => {
        features.forEach(f => {
            if (f.properties.cluster) {
                point_counts.push(f.properties.point_count)
            }
        });

        return point_counts;
    };

    const updateMarkers = () => {
        document.getElementById('key').innerHTML = '';
        let newMarkers = {};
        const features = map.querySourceFeatures('progLanguages');
        totals = getPointCount(features);
        features.forEach((feature) => {
            const coordinates = feature.geometry.coordinates;
            const props = feature.properties;

            if (!props.cluster) {
                return;
            }

            const id = props.cluster_id;

            let marker = markers[id];
            if (!marker) {
                const el = createDonutChart(props, totals);
                marker = markers[id] = new mapboxgl.Marker({
                    element: el
                })
                    .setLngLat(coordinates)
            }

            newMarkers[id] = marker;

            if (!markersOnScreen[id]) {
                marker.addTo(map);
            }
        });

        for (id in markersOnScreen) {
            if (!newMarkers[id]) {
                markersOnScreen[id].remove();
            }
        }
        markersOnScreen = newMarkers;
    };

    const createDonutChart = (props, totals) => {
        const div = document.createElement('div');
        const data = [
            {type: 'node', count: props.node},
            {type: 'cSharp', count: props.cSharp},
            {type: 'go', count: props.go},
            {type: 'ruby', count: props.ruby},
            {type: 'java', count: props.java},
        ];

        const thickness = 10;
        const scale = d3.scaleLinear()
            .domain([d3.min(totals), d3.max(totals)])
            .range([500, d3.max(totals)]);

        const radius = Math.sqrt(scale(props.point_count));
        const circleRadius = radius - thickness;

        const svg = d3.select(div)
            .append('svg')
            .attr('class', 'pie')
            .attr('width', radius * 2)
            .attr('height', radius * 2);

        //center
        const g = svg.append('g')
            .attr('transform', `translate(${radius}, ${radius})`);

        const arc = d3.arc()
            .innerRadius(radius - thickness)
            .outerRadius(radius);

        const pie = d3.pie()
            .value(d => d.count)
            .sort(null);

        const path = g.selectAll('path')
            .data(pie(data.sort((x, y) => d3.ascending(y.count, x.count))))
            .enter()
            .append('path')
            .attr('d', arc)
            .attr('fill', (d) => colorScale(d.data.type));

        const circle = g.append('circle')
            .attr('r', circleRadius)
            .attr('fill', 'rgba(0, 0, 0, 0.7)')
            .attr('class', 'center-circle');

        const text = g
            .append("text")
            .attr("class", "total")
            .text(props.point_count_abbreviated)
            .attr('text-anchor', 'middle')
            .attr('dy', 5)
            .attr('fill', 'white');

        const infoEl = createTable(props);

        svg.on('click', () => {
            d3.selectAll('.center-circle').attr('fill', 'rgba(0, 0, 0, 0.7)');
            circle.attr('fill', 'rgb(71, 79, 102)');
            document.getElementById('key').innerHTML = '';
            document.getElementById('key').append(infoEl);
        });

        return div;
    };

    const createTable = (props) => {
        const getPerc = (count) => {
            return count / props.point_count;
        };

        const data = [
            {type: 'node', perc: getPerc(props.node)},
            {type: 'go', perc: getPerc(props.go)},
            {type: 'c#', perc: getPerc(props.cSharp)},
            {type: 'ruby', perc: getPerc(props.ruby)},
            {type: 'java', perc: getPerc(props.java)},
        ];

        const columns = ['type', 'perc'];
        const div = document.createElement('div');
        const table = d3.select(div).append('table').attr('class', 'table');
        const thead = table.append('thead');
        const tbody = table.append('tbody');

        thead.append('tr')
            .selectAll('th')
            .data(columns).enter()
            .append('th')
            .text((d) => {
                return d === 'perc' ? '%' : 'Backend language (last 14 days); stackoverflow.com/jobs';
            });

        const rows = tbody.selectAll('tr')
            .data(data.filter(i => i.perc).sort((x, y) => d3.descending(x.perc, y.perc)))
            .enter()
            .append('tr')
            .style('border-left', (d) => `20px solid ${colorScale(d.type)}`);

        // create a cell in each row for each column
        const cells = rows.selectAll('td')
            .data((row) => {
                return columns.map((column) => {
                    let val = column === 'perc' ? d3.format(".2%")(row[column]) : row[column];
                    return {column: column, value: val};
                });
            })
            .enter()
            .append('td')
            .text((d) => d.value)
            .style('text-transform', 'capitalize');

        return div;
    };

    map.on('data', (e) => {
        if (e.sourceId !== 'progLanguages' || !e.isSourceLoaded) return;

        map.on('move', updateMarkers);
        map.on('moveend', updateMarkers);
        updateMarkers();
    });
});