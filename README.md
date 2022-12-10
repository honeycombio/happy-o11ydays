# Happy O11ydays

It's picture time!

Run the code in this repo, hooked up to your Honeycomb team. The program will send some events to Honeycomb, and those events will vizualize into a picture.

In the process, learn some tricks about Honeycomb.

## You will need

A Honeycomb account. Get a free one [here](https://honeycomb.io/signup), or use an existing one ([concerns?](#use-an-existing-account)).

## How to do it

You can clone this repository, or open in an online IDE in GitPod:

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/jessitron/hny-art-node)

Get a [Honeycomb API Key]().

Put that in an environment variable:

`export HONEYCOMB_API_KEY="your-api-key"`

Now run the program:

`./run`

This will send events to Honeycomb. The program will print out a link to the right environment and dataset.

## See the heatmap

To see the picture, we need to draw a heatmap.

Choose "New Query" on the left navigation bar.

Under "VISUALIZE" enter "heatmap(height)"

For the time frame, select the last 10 minutes. // TODO: picture; this is hard to find

You should see something, but it might not look like much yet.

### Change the granularity

By default, the 10-minute heatmap looks at 1-second intervals. Let's make it group things into 5-second intervals.

Click the timeframe dropdown again, but this time look past all the time options. At the bottom of that dropdown,
there's a way to change the granularity.
// TODO: get the instructions right. also picture

Choose 5 seconds. Do you see a picture??

Give the query a name so you can find it again! // picture

Copy the link in the URL bar, and send it to your coworkers.

### Bonus: set the default granularity for the dataset

When someone else looks at this dataset, you want them to see the picture too.
Let's make it choose 5 seconds as the granularity automatically, so people
don't have to change it every time.

Go to Dataset Settings // TODO: instructions, picture.

Click on some stuff

### Learning: what did we do here?

#### Heatmap

A Heatmap graphs how many things happened across a range of some numeric value, and also across time.
The x axis is time: when did it happen? The y axis is "how much."
Often we graph latency as "heatmap(duration_ms)", so higher is slower.
In this artistic example, we graphed "heatmap(height)" because 'height' is a field
we put in these toy events for exactly this purpose. It represents height above the x axis in the picture.

Then the cool part about the heatmap: darker is more. The colors in the heatmap convey frequency.
If a certain value (say, a height of 10) appears only once in the data in a 5-second interval, that spot
is light blue. If it happened a lot (maybe there were five events with that value for 'height' at that time)
then the spot is darker.

If you're graphing latency on of production requests, a dark spot might be 5000 events.
In this toy dataset, there are at most 10 events for a particular 5-second interval and height value,
so a dark spot is 10 events. The legend on the heatmap tells you how big the difference is.
// TODO: picture

#### Granularity

In a heatmap, the data is divided into buckets. Each bucket is as wide as the time granularity on the graph:
1 second is the default for a 10-minute time range. A 30 day time range has a granularity of a day, so events
for the whole day will wind up in the same bucket.

The buckets also have a height: a range of the value on the y-axis. If this is "heatmap(duration_ms)" then each bucket
might be 1ms or 500ms tall. The bucket will be tall enough so that in fifty or so buckets, it can still display the
highest value found in the data, the heighest dot on the graph.

You can control the width of the buckets by setting granularity. The height of the buckets are set automatically.

Honeycomb queries your data across the time range, excluding anything you filtered out in the WHERE box, and then
assigns each event to a bucket. The more events in the bucket, the darker the spot in the graph.

#### Default granularity

Setting the default granularity for a dataset expresses something about the data inside.
If events arrive at most every 5 seconds, like in this toy dataset, then a smaller granularity doesn't work.

In a metrics dataset, perhaps the counts are updated only once a minute, or every 5 minutes.
Setting a default granularity to match will help everyone who queries that dataset.

## Bubble Up on Heatmap

Here's a fun trick. What is different about the events that form [the eye]?

Bring up your "heatmap(height)" graph. (You can always find your past queries in
Activity History on the left nav.)

### Bubble Up

Now click the Bubble Up tab.

Now draw a box around [the eye].

A bunch of little bar graphs appear below it!

The bar graphs at the top represent attributes on the [eye] events
that are most different from the other events included in the heatmap.

Each little bar graph tells you about one attribute.
The yellow bars represent the events in the box you drew.
The height of each bar is the percentage of events that have each value.

The dark blue bars represent the events in the heatmap, but not in the box.
This is the baseline, while the yellow is the selection.

### Group by

Once you find an attribute that looks different, it's often useful to break
out events by that attribute, to see what effect it has on the events.

If this were a heatmap of latency, we'd be looking for what makes
some events slower than others. Right now, we're just having fun.

Click the top-left attribute. A little menu pops up; choose "Group by field" // TODO: get this right, picture

Look at the GROUP BY box in the query definition, and now that attribute is in there.

Next, click the "Results" tab to get out of Bubble Up and see the groups.
// picture of those two

Notice the table of results underneath the graph.
Each row represents one value of your attribute.

Hover over each row in the table. What happens to the picture?

As you hover over each row, the heatmap displays only the events in that group.
This makes it easy to see the difference that attribute makes in the distribution of events.

In real life, if your heatmap shows latency, and you're grouping on user_id,
then hovering over rows might reveal that response times are much slower for a few particular users.

...

## Use an Existing Account

If you create the picture in a shared Honeycomb account, then your friends can see it too!
You can link to the visualization and have it show up in Slack - super cute!

Send this data to a development environment. Don't use your production environment's API key.

#### If I run this program to send events to your work Honeycomb instance, will it use up my event quota?

This program will send a few thousand events each time you run it. A free Honeycomb account has a limit of 20 million
events per month. Paid Honeycomb account quotas range from hundreds of millions to billions of events per month.

So, you might use 0.0001% of a paid monthly quota. It should be fine.

#### Will this create a dataset that hangs out forever?

It will make a dataset that stays around until you delete it.
When you take down the Christmas decorations, [delete](https://docs.honeycomb.io/working-with-your-data/settings/#delete-1) this dataset.

To do this, be a team owner (or pair with one). Be in the development environment that you sent data to.
Choose "Datasets" on the left nav. Then click the name of the dataset, like "viz-art" or whatever yours is called.
This opens dataset settings. From here, one of the tabs at the top says "Delete." This tab has the button you want.


## Delete the dataset
