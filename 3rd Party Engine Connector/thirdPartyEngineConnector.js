//Author: Fady Heiba
//Date of release: June 1st, 2016

/*A general overview of how the code works (refer to the comments in the code for more details):
- paint function starts.
- Go through each data row in the last datapage (in this case 1000 rows each or the remaining rows) loaded and fetch the dimensions and measures to our final data array.
- If we're done retrieving all the rows, send all the data to Matlab, then render the visualization.
- If there are still rows remaining we haven't pulled, request another page of data, either 1000 rows or if the remaining rows.
- Recursive paint function (back to top).*/

//To Configure New Third Party Engine Functions:
/*New third party engine JavaScript functions will have to receive Qlik's dimension and measure inputs as an array of objects with properties such as Dim0, Dim1, etc and Meas0, Meas1, etc and also output as an array of objects if it will be visualizing using the D3 charts.

Please don't hesitate to email me at fady.heiba@qlik.com for help with new functions.*/





//Connecting all files we'll be using
define(["jquery", 
        "text!./thirdPartyEngineConnector.css",
        "./d3.min",
        "./d3.tip.v0.6.3",
        "./ArimaForecast/opencpu-0.4"],
       function($, cssContent) {

    'use strict';
    $("<style>").html(cssContent).appendTo("head");

    /*initial properties and the definition function get called only when
      the extension is created. If you resize, update the
      variables, or filter selections, it doesn't get called again. 
      (recreating the object is necessary for changes here to apply)*/
    return {
        initialProperties : {
            qHyperCubeDef : {
                qDimensions : [],
                qMeasures : [],
                qInitialDataFetch : [{
                    qWidth : 0,
                    qHeight : 0
                }]
            }
        },
        definition : {
            type : "items",
            component : "accordion",
            items : {
                dimensions : {
                    uses : "dimensions",
                    min : 1, // Date as a dimension
                    max : 5
                },
                measures : {
                    uses : "measures",
                    min : 1, // Our optimizer will accept 2-6 assets
                    max : 10
                },
                sorting : {
                    uses : "sorting"
                },
                //Custom Settings
                settings : {
                    uses : "settings",
                    items : {
                        //--------------------------START: ADD ALL SETTINGS HERE------------------------
                        engineSettings: {
                            type : "items",
                            //Title of Custom Settings
                            label: "3rd Party Engine Settings",
                            items : {
                                //Ref: Setting Reference so we can call from visualization as layout.colorOfUnder
                                //Label: Title of Setting
                                //Type: Type of Input
                                masterSwitch: {
                                    ref: "masterSwitch",
                                    type: "string",
                                    component: "dropdown",
                                    label: "Master Switch",
                                    options: 
                                    [{
                                        value: "1",
                                        label: "ON"
                                    },
                                     {
                                         value: "2",
                                         label: "OFF"
                                     }],
                                    defaultValue: "2"
                                },
                                engineFunction: {
                                    ref: "engineFunction",
                                    type: "string",
                                    component: "dropdown",
                                    label: "3rd Party Engine Function",
                                    options: 
                                    [{
                                        value: "1",
                                        label: "Matlab Diagnostics"
                                    }, {
                                        value: "2",
                                        label: "Matlab Portfolio Optimization"
                                    },
                                     {
                                         value: "3",
                                         label: "R ARIMA Forecast"
                                     }],
                                    defaultValue: "2"
                                },
                                //Dropdown and its options
                                chartType: {
                                    ref: "chartType",
                                    type: "string",
                                    component: "dropdown",
                                    label: "Output Chart Type",
                                    options: 
                                    [{
                                        value: "1",
                                        label: "Donut Chart"
                                    }, {
                                        value: "2",
                                        label: "Bar Chart"
                                    },
                                     {
                                         value: "3",
                                         label: "Image"
                                     }],
                                    defaultValue: "1"
                                }
                            }
                        },
                        mpsAPIURL: {
                            type : "items",
                            //Title of Custom Settings
                            label: "Matlab Production Server URL",
                            items : {
                                mpsURL: {
                                    ref : "mpsURL",
                                    label : "MPS API URL",
                                    type : "string",
                                    expression: "optional",
                                    defaultValue: ""
                                }
                            }
                        },
                        rServerURL: {
                            type : "items",
                            //Title of Custom Settings
                            label: "R Server URL",
                            items : {
                                RServer : {
                                    ref : "r_server",
                                    label : "R Server",
                                    type : "string",
                                    expression: "optional",
                                    defaultValue: "public.opencpu.org"
                                }
                            }
                        },
                        arimaForecast: {
                            type : "items",
                            //Title of Custom Settings
                            label: "ARIMA Forecast Settings",
                            items : {
                                rmodel : {
                                    ref : "rmodel",
                                    type : "string",
                                    component : "dropdown",
                                    label : "Forecast Model",
                                    options : [{
                                        value : "auto.arima",
                                        label : "auto.arima"
                                    }, {
                                        value : "Arima",
                                        label : "Arima"
                                    }, {
                                        value : "bats",
                                        label : "bats"
                                    }],
                                    defaultValue : "auto.arima"
                                }, 
                                Freq : {
                                    ref : "frequency",
                                    label : "Frequency",
                                    type : "integer",
                                    expression: "optional",
                                    defaultValue: 12
                                },
                                Start : {
                                    ref : "start",
                                    label : "Start",
                                    type : "string",
                                    expression: "optional",
                                    defaultValue: "c(1990,1)"
                                },
                                nPeriods : {
                                    ref : "nperiods",
                                    label : "Max Number of Forecasting Periods",
                                    type : "string",
                                    expression: "optional",
                                    defaultValue: 18
                                }
                            }
                        },
                    }
                    //--------------------------END: ADD ALL SETTINGS HERE--------------------------
                } //end of settings    
            }
        },
        //For adding snapshots of this chart object to Stories
        snapshot : {
            canTakeSnapshot : true
        },
        //paint is the function that gets called every time the
        //variables or selection changes, or if you resize the window.
        paint : function($element, layout, lastrow, data, dataPageLimit, noOfDim, noOfMeas) {
            //Hardcoding a limitation of 10K rows for now to prevent accidents that overload memory
            if(this.backendApi.getRowCount()<10000){

                var self = this;
                //Initialize variables used in recursion
                if(lastrow == null){
                    lastrow = 0;
                    var data = [];
                    var dataPageLimit = 0;
                    var noOfMeas = layout.qHyperCube.qMeasureInfo.length;
                    var noOfDim = layout.qHyperCube.qSize.qcx - noOfMeas;
                }                

                /*For each row of data in the datapage we've pulled in the last recursion,
                assign the row's dimension and measures into its own object
                in the final data array.*/
                while(lastrow<dataPageLimit){
                    //Logging the amount of rows being loaded
                    if(lastrow % 500 == 0){
                        console.log('RowNumber is: ',lastrow); //For testing iteration efficiency
                    }

                    var row = this.backendApi.getDataRow(lastrow);
                    data[lastrow] = new Object;

                    //Pulling the dimesions' text and the measures' numbers into our data array
                    for (var i = 0; i < noOfDim; i++) { 
                        var dimPropertyName = 'Dim' + i;
                        var dimPropertyNum = 'Dim' + i + 'Num';
                        data[lastrow][dimPropertyName] = row[i].qText;
                        data[lastrow][dimPropertyNum] = row[i].qNum;
                    }
                    for(var i = noOfDim; i < row.length; i++){
                        var measPropertyName = 'Meas' + (i-noOfDim);
                        data[lastrow][measPropertyName] = row[i].qNum;
                    }

                    lastrow = lastrow + 1;
                }

                /*If we have all the data pages already, initialize the element, send
                Matlab the data, and render the results in a D3.JS visualization.*/
                if(this.backendApi.getRowCount() == lastrow){
                    // Extract the selected data from the hypercube as well as labels for future rendering
                    var measureLabels = layout.qHyperCube.qMeasureInfo.map(function(d) {
                        return d.qFallbackTitle;
                    });

                    // Initializing element to draw or redraw itself based on the current variables
                    var width = $element.width();
                    var height = $element.height();
                    var id = "container_" + layout.qInfo.qId;
                    if (document.getElementById(id)) {
                        $("#" + id).empty();
                    }
                    else {
                        $element.append($('<div />;').attr("id", id).width(width).height(height));
                    }

                    //Logging final getData() results
                    console.log('RowNumber is: ', lastrow);
                    console.log('__________________________');
                    console.log('Total Rows Rendered: ', this.backendApi.getRowCount());
                    console.log('Raw Data Sent to 3rd Party Engine:', data);

                    //Clearing any warning text before visualizing again
                    if(document.getElementById("thirdpartyengine") != null){
                        document.getElementById("thirdpartyengine").innerHTML = "";
                    }

                    //--------------------------START: APPLY ALL FUNCTIONS HERE------------------------
                    if(layout.masterSwitch == "1"){

                        if(layout.engineFunction == "1"){
                            // Diagnostic display - canary to indicate if MPS is alive
                            mpsDiagnostics($element, layout)
                        }
                        else if(layout.engineFunction == "2"){                  
                            if(layout.chartType != "1" && layout.chartType != "2"){
                                $element.html('<p id="thirdpartyengine">This visualization type is not supported by the selected function.</p>');
                            }
                            else if(layout.qHyperCube.qDimensionInfo.length >= 2 || layout.qHyperCube.qMeasureInfo.length <= 2){
                                $element.html('<p id="thirdpartyengine">This function requires one date dimension and at least three measures of stock prices. Please make sure the correct dimensions/measures are input and refresh.</p>');
                            }
                            else{
                                //Compute an optimal portfolio given the selected data
                                var weights = computeOptimalPortfolio(data, layout, noOfDim, noOfMeas, measureLabels);
                                console.log('Incoming Data from Matlab:', weights);

                                // Send the data to the visualization
                                if(layout.chartType == "1"){
                                    donutChartViz(weights, width, height, id, noOfDim, noOfMeas);
                                }
                                else if(layout.chartType == "2"){
                                    barChartViz(weights, width, height, id, noOfDim, noOfMeas);
                                }
                            }

                        }
                        else if(layout.engineFunction == "3"){
                            if(layout.chartType != "3"){
                                $element.html('<p id="thirdpartyengine">This visualization type is not supported by the selected function.</p>');
                            }
                            else if(layout.qHyperCube.qDimensionInfo.length != 1 || layout.qHyperCube.qMeasureInfo.length != 1){
                                $element.html('<p id="thirdpartyengine">This function requires one dimension and one measure. Please make sure the correct dimensions/measures are input and refresh.</p>');
                            }
                            else{
                                var properties = self.backendApi.getProperties();
                                computeARIMAForecast($element, layout, data, noOfDim, noOfMeas, properties);
                            }
                        }

                    }
                    else if(layout.masterSwitch == "2"){
                        if(layout.engineFunction == "1"){
                            $element.html('<p id="thirdpartyengine">This function does not use any dimensions or measures. It is used for testing the connection with the Matlab Production Server.</p>');
                        }
                        else if(layout.engineFunction == "2"){                  
                            if(layout.chartType != "1" && layout.chartType != "2"){
                                $element.html('<p id="thirdpartyengine">This visualization type is not supported by the selected function.</p>');
                            }
                            else{
                                $element.html('<p id="thirdpartyengine">This function requires one date dimension and at least three measures of stock prices. It is used for allocating investments across various stocks based on historical data. Please make sure the correct dimensions/measures are input and refresh.</p>');
                            }
                        }
                        else if(layout.engineFunction == "3"){
                            if(layout.chartType == "3"){
                                $element.html('<p id="thirdpartyengine">This function requires one dimension and one measure. It is used for predictive analytics, forecasting with a moving average.</p>');
                            }
                            else{
                                $element.html('<p id="thirdpartyengine">This visualization type is not supported by the selected function.</p>');
                            }
                        }

                    } //end of masterSwitch
                    //--------------------------END: APPLY ALL FUNCTIONS HERE--------------------------
                } //end of IfDone

                /*If there are yet rows we don't have, request a new page of either 1000 rows or the remaining number of rows.*/
                if(this.backendApi.getRowCount() > lastrow) {
                    var requestPage = [{
                        qTop : lastrow,
                        qLeft : 0,
                        qWidth : noOfDim + noOfMeas, //should be # of columns
                        qHeight : Math.min(1000, this.backendApi.getRowCount() - lastrow)
                    }];
                    var totalRows = this.backendApi.getRowCount();

                    self.backendApi.getData(requestPage).then(function(/*dataPages*/) {
                        dataPageLimit = dataPageLimit + Math.min(1000, totalRows - lastrow);

                        //Recursive paint function:
                        self.paint($element, layout, lastrow, data, dataPageLimit, noOfDim, noOfMeas);
                    });
                }
            } //end of 10k limitation if function
            else{
                console.log('This function is limited to 10,000 records.');
            }
        } //end of paint
    }; //end of return
}); //end of function


//--------------------------START: APPLY ALL FUNCTIONS HERE------------------------

/*R Server Functions*/
function computeARIMAForecast($element, layout, dataset, noOfDim, noOfMeas, prop){
    if(layout.chartType != "1" && layout.chartType != "2"){
        $element.html("asdfasdfasdf");
    }


    var mySession;
    var val = new Array();
    var mean = new Array();
    var upper = new Array();
    var lower = new Array();
    var data = new Array();
    var rData = new Array();
    var myJsondata;

    // declare vars
    var forecastPeriods = layout.nperiods;
    var csv = new Array();
    var self = this;

    // Define HTML
    var html = '';
    html += '<style>';
    html += 'body {';
    html += '  font: 10px sans-serif;';
    html += '}';
    html += '.axis path,';
    html += '.axis line {';
    html += '  fill: none;';
    html += '  stroke: #000;';
    html += '  shape-rendering: crispEdges;';
    html += '}';
    html += '.x.axis path {';
    html += '  display: none;';
    html += '}';
    html += '.line {';
    html += '  fill: none;';
    html += '  stroke: steelblue;';
    html += '  stroke-width: 1.5px;';
    html += '}';
    html += 'div.err {';
    html += '  font: 10px san-serif;';
    html += '  color: red;'; 
    html += '}'; 
    html += '</style>';
    html += '<div id="lblNumPeriods'+layout.qInfo.qId+'"  width="70%">'+layout.nperiods+'</div>';
    html += '<div id="lblStatus'+layout.qInfo.qId+'" width="30%"></div></ br>';
    html += '<form><div id="inputSlider'+layout.qInfo.qId+'"><input id="sliderNumPeriods'+layout.qInfo.qId+'" type="range" name="points" min="0" max="'+layout.nperiods+'" value="'+layout.nperiods+'"></div></form>'; 
    html += '<div id="chart'+layout.qInfo.qId+'" style="height:100%;width:100%" ></div><br>';
    html += '<div id="outforecast'+layout.qInfo.qId+'" scroll="overflow" ></div><br>';
    html += '<div id="msg'+layout.qInfo.qId+'" class="err"></div><br>';
    var appendHtml="";

    // Get the data from qlik
    data=[];
    rData=[];
    var	dimensions = layout.qHyperCube.qDimensionInfo;
    var matrix = layout.qHyperCube.qDataPages[0].qMatrix;

    if ( dimensions && dimensions.length > 0 ) {                   
        dataset.forEach(function(row) {
            if((row.Meas0)!='NaN'){
                var obj = { "date":row.Dim0Num, "Actual":row.Meas0};
                data.push(obj);
                rData.push(row.Meas0);
            }
        });
    }

    function r_forecast() {	
        var st = new ocpu.Snippet(layout.start);
        ocpu.seturl("http://" + layout.r_server + "/ocpu/library/stats/R");

        var timeSeries = ocpu.call('ts', 
                                   {'data': rData, 
                                    'start': st,
                                    'frequency': layout.frequency //12
                                   },
                                   function(tsSession){
            // Set the library to be used: Forecast
            ocpu.seturl("http://" + layout.r_server + "/ocpu/library/forecast/R");
            mySession = '';
            var req = ocpu.call(layout.rmodel, 
                                {x:tsSession}, 
                                function(session2){
                mySession = session2;
                var reqJson = ocpu.rpc("forecast", {object : mySession, h : forecastPeriods, force : "true"},
                                       function(jsondata){
                    myJsondata = jsondata;
                    // plot it
                    var plotreq = $("#chart"+layout.qInfo.qId).rplot("plot.splineforecast", {x : jsondata}).fail(function(){
                        $("#msg"+layout.qInfo.qId).text("R returned an error: " + plotreq.responseText);
                    });
                    // clear out the status message
                    $("#lblStatus"+layout.qInfo.qId).html("");
                }).fail(function(){
                    $("#msg"+layout.qInfo.qId).text("Error: " + reqJson.responseText);
                });
            }).fail(function(){
                $("#msg"+layout.qInfo.qId).text("Error: " + req.responseText);
            }); 
        }).fail(function(){
            $("#msg").text("Error: " + timeSeries.responseText);
        }); 
    }
    // set the html code for the ext objext
    $element.html( html );

    // call to R server to perform forecast
    r_forecast();

    //setup listener for changes made to slider
    $("#sliderNumPeriods"+layout.qInfo.qId).change(function() {
        forecastPeriods = $(this).val() + '';
        if(forecastPeriods<1){
            forecastPeriods=1;
            $(this).val=1;
        };
        r_forecast();
        $("#lblNumPeriods"+layout.qInfo.qId).text( forecastPeriods );
        $("#lblStatus"+layout.qInfo.qId).html("Contacting R server " + layout.r_server + "...");
    });
}




/*MATLAB Functions*/
// Call MPS to compute the optimal portfolio
/*To use this demo, you will need to have access to a running instance of MPS with the
Portfolio Optimization code running as a service.*/
function computeOptimalPortfolio(data, layout, noOfDim, noOfMeas, labels){

    //Retrieve the selected dimensions from Qlik Sense

    var upperBound = 0.45;
    var dimensions = [];
    var measures = [];

    for (var i = 0; i < noOfDim; i++) {
        var dimPropertyName = 'Dim' + i;
        dimensions[i] = data.map(function(d) { return d[dimPropertyName]; });
    }
    for(var i = noOfDim; i < (noOfDim + noOfMeas); i++){
        var measPropertyName = 'Meas' + (i-noOfDim);
        measures[i-noOfDim] = data.map(function(d) { return d[measPropertyName]; });
    }

    // Create a second request to perform the compute
    var optURL = layout.mpsURL +'/optimizePortfolio/optimizePortfolio';

    // Create a request with the selected data - ASH: This can be made much cleaner - quick and dirty for now
    var reqStr =     
        '{"rhs":['+
        '{"mwtype":"cell",'+
        '"mwsize":['+dimensions[0].length+',1],'+
        '"mwdata": '+JSON.stringify(dimensions[0])+
        '},'+
        '{"mwtype":"double",'+
        ' "mwsize":['+dimensions[0].length+','+noOfMeas+'],'+
        ' "mwdata":[';
    for(var i = noOfDim; i < (noOfDim + noOfMeas); i++){
        if(i==noOfDim){
            reqStr += measures[i-noOfDim];
        }
        else{
            reqStr += ','+ measures[i-noOfDim];
        }
    }
    reqStr += ']'+
        '},'+
        '{"mwtype":"double",'+
        ' "mwsize":[1,1],'+
        ' "mwdata":[ ' +upperBound+ ']}'+
        '],'+
        '"nargout":1}';
    //        console.log(reqStr);

    // Create a request
    var optReq = new XMLHttpRequest(); // a new request
    optReq.open("POST",optURL,false);

    // Set application payload to JSON
    optReq.setRequestHeader('Content-Type','application/json');

    // Send a request to optimize the portfoliow
    optReq.send(reqStr);

    // Parse the response
    var optResponse = JSON.parse(optReq.responseText);

    var dataset = [];
    for(var i = 0; i < noOfMeas; i++){
        dataset[i] = new Object;
        dataset[i] = { label: labels[i] , count: optResponse.lhs[0].mwdata[i] };
    }

    // Return the weights
    return dataset;
}



// Call MPS and return the version information as a string that gets painted visibly
function mpsDiagnostics(element, layout){
    // MATLAB Production Server URL
    var serverURL = layout.mpsURL +'/optimizePortfolio/getVersion';

    // Create a request
    var Httpreq = new XMLHttpRequest(); // a new request
    Httpreq.open("POST",serverURL,false);

    // Set application payload to JSON
    Httpreq.setRequestHeader('Content-Type','application/json');

    // Send Sample request
    Httpreq.send('{"rhs":0,"nargout":1}');
    var mlResponse = JSON.parse(Httpreq.responseText);

    // Log to console and display for a basic check
    element.html('<p id="thirdpartyengine">' + mlResponse.lhs[0].mwdata[0] + '</p>');
}

//--------------------------END: ADD ALL FUNCTIONS HERE--------------------------


//--------------------------START: ADD ALL VISUALIZATIONS HERE------------------------
//Creating a D3.JS-based visualization
var donutChartViz = function (dataset, width, height, id, noOfDim, noOfMeas) {

    //Feeding D3 our element's width and height
    var margin = {top: 20, right: 20, bottom: 30, left: 40},
        width = width - margin.left - margin.right,
        height = height - margin.top - margin.bottom;

    //Sizing the donut radius to half the minimal dimension
    var radius = Math.min(width,height)/2;

    var donutWidth = 75;
    var legendRectSize = 18;                                  
    var legendSpacing = 4;                                    

    //var color = d3.scale.category20b();
    //Making it a bit more colorful
    var color = d3.scale.category10();

    //Adding an SVG element into available space
    var svg = d3.select("#"+id)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .append('g')
    .attr('transform', 'translate(' + (width / 2) + 
          ',' + (height / 2) + ')');

    //Drawing the donut
    var arc = d3.svg.arc()
    .innerRadius(radius - donutWidth)
    .outerRadius(radius);

    //Visualizing it out
    var pie = d3.layout.pie()
    .value(function(d) { return d.count; })
    .sort(null);

    //Adding a filling
    var path = svg.selectAll('path')
    .data(pie(dataset))
    .enter()
    .append('path')
    .attr('d', arc)
    .attr('fill', function(d, i) { 
        return color(d.data.label);
    });

    //Specifying a legend
    var legend = svg.selectAll('.legend')                     
    .data(color.domain())                                   
    .enter()                                                
    .append('g')                                            
    .attr('class', 'legend')                                
    .attr('transform', function(d, i) {                     
        var height = legendRectSize + legendSpacing;          
        var offset =  height * color.domain().length / 2;     
        var horz = -2 * legendRectSize;                       
        var vert = i * height - offset;                       
        return 'translate(' + horz + ',' + vert + ')';        
    });                                                     

    //Adding a color key to the legend
    legend.append('rect')                                     
        .attr('width', legendRectSize)                          
        .attr('height', legendRectSize)                         
        .style('fill', color)                                   
        .style('stroke', color);                                

    //Adding data labels
    legend.append('text')                                     
        .attr('x', legendRectSize + legendSpacing)              
        .attr('y', legendRectSize - legendSpacing)              
        .text(function(d) { return d; });                       

    //Adding tooltips 
    var tooltip = d3.select("#"+id)                               
    .append('div')                                        
    .attr('class', 'tooltip');                            

    tooltip.append('div')                                   
        .attr('class', 'label');                              

    tooltip.append('div')                                   
        .attr('class', 'count');                              

    tooltip.append('div')                                   
        .attr('class', 'percent');                            

    // Enable the tooltip
    path.on('mouseover', function(d) {                            
        var total = d3.sum(dataset.map(function(d) {                
            return d.count;                                           
        }));                                                        
        var percent = Math.round(1000 * d.data.count / total) / 10; 
        tooltip.select('.label').html(d.data.label);                
        tooltip.select('.percent').html(percent + '%');             
        tooltip.style('display', 'block');                          
    });                                                           

    //Removing the tooltip
    path.on('mouseout', function() {                              
        tooltip.style('display', 'none');                           
    });                                                           
}



var barChartViz = function (dataset, width, height, id, noOfDim, noOfMeas) {

    var margin = {top: 20, right: 20, bottom: 30, left: 40},
        width = width - margin.left - margin.right,
        height = height - margin.top - margin.bottom;

    var x = d3.scale.ordinal()
    .rangeRoundBands([0, width], .1);

    var y = d3.scale.linear()
    .range([height, 0]);

    var xAxis = d3.svg.axis()
    .scale(x)
    .orient("bottom");

    var yAxis = d3.svg.axis()
    .scale(y)
    .orient("left")
    //    .ticks(10, "%");

    var svg = d3.select("#"+id).append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


    x.domain(dataset.map(function(d) { return d.label; }));
    y.domain([0, d3.max(dataset, function(d) { return d.count; })]);

    dimensions = function(d) { return x(d.label); };

    measures = function(d) { return y(d.count); };

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);

    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis)
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text(dataset.label);

    svg.selectAll(".bar")
        .data(dataset)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", function(d) { return x(d.label); })
        .attr("width", x.rangeBand())
        .attr("y", function(d) { return y(d.count); })
        .attr("height", function(d) { return height - y(d.count); });

    function type(d) {
        d.count = +d.count;
        return d;
    }
}

//--------------------------END: ADD ALL VISUALIZATIONS HERE------------------------