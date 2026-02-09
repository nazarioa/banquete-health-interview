# Deployment

### Version 1 - MVP

The first version of this product is very simple.
I think a simple AWS Elastic BeanStock setup with AWS Relation Database can work for the start.

I don't have hard numbers on the average hospital capacity. I guess we can find out from COVID Data. Both in terms of overall users to start, we are not in the millions or maybe even in the thousands. In terms of speed. Even if there were tens of thousands hitting the service at the same time AWS should be to handle ( by scaling up).

For the automated service specifically there could be an issue if the user tries to both hot the API while orders are going in. IN this case I think a simple... "The kitchen is cooking, orders for 'lunch' are on hold"

<img src="./BasicAWS%20Solutions%20V1.png" alt="Basic AWS Solutions V1">

### Version 2 - Security / Resilience

More than scaling I think the bigger issue maybe security / resilience. What happens if the internet goes down?

In this case it may make more sense to have an appliance at each location running docker containers with the database, backend, web-frontend.

Should the internet be disrupted users can continue to palce and track their orders.

Where is the kitchen? If the kitchen is housed outside the Hospital like at a commissary, then we can hqve a messaging service that sends data either in batches or on specific events to an external system that would only receive what to make and where it goes.

### Version 3 - Orchestration

There maybe a need to orchestrate multiple kitchens and or delivery trucks in which case we can look at microserveces or a whole different backend specific to those needs.
