mapboxgl.accessToken = 'pk.eyJ1Ijoia29uc3RhbnRpbmJpcml1a292IiwiYSI6ImNrMWsxYjc1bjBrdjQzZHBiNTlhbjBqdmwifQ.vAlGhe7KTCajh5VvGfMJow';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    zoom: 3,
    center: [-90.1878, 38.6260]
});

const colors = ['#8dd3c7', '#bebada', '#fb8072',"#80b1d3"];

const colorScale = d3.scaleOrdinal()
    .domain(["Netflix", "Facebook Careers", "Apple  ", "Amazon"])
    .range(colors);

// filters to define our categories using conditional logic
const netflix = ['==', ['get', 'Website'], 'Netflix'];
const facebook = ['==', ['get', 'Website'], 'Facebook Careers'];
const apple = ['==', ['get', 'Website'], 'Apple  '];
const amazon = ['==', ['get', 'Website'], 'Amazon'];


map.on('load', () => {
    // add a clustered GeoJSON source for progLanguages
    map.addSource('faang', {
        'type': 'geojson',
        'data': faang,
        'cluster': true, // to enable clustering to the source
        'clusterRadius': 75, //100
        'clusterProperties': { // keep separate counts for each lang category in a cluster,
            // defining the categories we want to keep track of; '+' returns the sum of the inputs,
            // 'case' selects the first output whose corresponding test condition evaluates to true, or the fallback value otherwise.
            'netflix': ['+', ['case', netflix, 1, 0]],
            'facebook': ['+', ['case', facebook, 1, 0]],
            'apple': ['+', ['case', apple, 1, 0]],
            'amazon': ['+', ['case', amazon, 1, 0]]

        }
    });

    map.addLayer({
        'id': 'faang_individual',
        'type': 'circle',
        'source': 'faang',
        'filter': ['!=', ['get', 'cluster'], true],
        'paint': {
            'circle-color': ['case',
                netflix, colorScale('netflix'),
                facebook, colorScale('facebook'),
                apple, colorScale('apple'),
                amazon, colorScale('amazon'),
                '#ffed6f'],
            'circle-radius': 5
        }
    });

    map.addLayer({
        'id': 'faang_individual_outer',
        'type': 'circle',
        'source': 'faang',
        'filter': ['!=', ['get', 'cluster'], true],
        'paint': {
            'circle-stroke-color': ['case',
                netflix, colorScale('netflix'),
                facebook, colorScale('facebook'),
                apple, colorScale('apple'),
                amazon, colorScale('amazon'),
                '#ffed6f'],
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
        const features = map.querySourceFeatures('faang');
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
            {type: 'netflix', count: props.netflix},
            {type: 'facebook', count: props.facebook},
            {type: 'apple', count: props.apple},
            {type: 'amazon', count: props.amazon}
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
            {type: 'Netflix', perc: getPerc(props.netflix)},
            {type: 'Facebook', perc: getPerc(props.facebook)},
            {type: 'Apple', perc: getPerc(props.apple)},
            {type: 'Amazon', perc: getPerc(props.amazon)}
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
                return d === 'perc' ? '%' : 'Company name';
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
        if (e.sourceId !== 'faang' || !e.isSourceLoaded) return;

        map.on('move', updateMarkers);
        map.on('moveend', updateMarkers);
        updateMarkers();
    });
});