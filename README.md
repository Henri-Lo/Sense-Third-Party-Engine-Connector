#Self-Service Visualization meets Advanced Analytics!

How can an average business user make minimal effort, and leverage the most valuable, yet advanced analytics functions, such as: Predictive Analytics, Regression, K-Means Clustering, Portfolio Optimization, ARIMA Forecast, etc...

This Qlik Sense extension serves as a generic gateway into 3rd party Analytics/Statistical engine such as Matlab, R, SAS, etc… and calling their services in real time. (Demo Video: https://www.youtube.com/watch?v=j-OhJPEFLg8)

The process goes as follows: 
a) The business user selects the 3rd party engine, function, data inputs and visualization outputs.
b) The extension pulls the selected raw data from Qlik's in-memory engine
c) The extension Sends the raw data, to the 3rd party engine for calculation
d) The output is visualized upon receiving the result back from the 3rd party engine

![alt tag](https://github.com/fadyheiba/Sense-Third-Party-Engine-Connector/blob/master/3rd%20Party%20Engine%20Connector/Integration%20Flowchart.png)

This version of the extension is configured with a Portfolio Optimization (Matlab function), and ARIMA Forecast (R function).

In this Qlik Sense app, the Fund Manager can select a historical period that he believes best resembles today's market conditions, and receives a portfolio allocation based on Matlab calculations, then proceed to compare it to his current positions, all in sub-second responses.
![alt tag](https://github.com/fadyheiba/Sense-Third-Party-Engine-Connector/blob/master/3rd%20Party%20Engine%20Connector/Matlab%20Example.png)

The next example uses a Predictive Analytics function in R, the ARIMA Forecast, to predict what the next month's sales will look like based on the past three years.
![alt tag](https://github.com/fadyheiba/Sense-Third-Party-Engine-Connector/blob/master/3rd%20Party%20Engine%20Connector/R%20Example.png)

####For Developers:
If you're interested in configuring new functions, please refer to the instruction comments at the top of the javascript file.

####Credit:
- Original ARIMA Forecast extension by Jeffrey Koch
- Special thanks to Arvind Hosagrahara from Matlab.
