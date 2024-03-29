# Happy O11ydays

It's picture time!

![the honeycomb logo in a honeycomb heatmap](docs/hny-logo-heatmap.png)

Run the code in this repo, hooked up to your Honeycomb team. The program will send some events to Honeycomb, and those events will vizualize into a picture.

In the process, learn some tricks about Honeycomb.

## You will need

A Honeycomb account. Get a free one [here](https://honeycomb.io/signup), or use an existing one ([concerns?](#use-an-existing-account)).

## How to do it

You can clone this repository, or open in an online IDE in GitPod:

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/honeycombio/happy-o11ydays)

Get a [Honeycomb API Key](https://docs.honeycomb.io/getting-data-in/api-keys/#find-api-keys).

Put that in an environment variable:

`export HONEYCOMB_API_KEY="your-api-key"`

Once, install dependencies:

`npm install`

Now run the program:

`./run`

This will send events to Honeycomb. The program will print out a link to the right environment and dataset.

## See the heatmap

To see the picture, we need to draw a heatmap.

Choose "New Query" on the left navigation bar.

Under "VISUALIZE" enter "heatmap(height)"

For the time frame, select the last 10 minutes.

![screenshot of query editor, as specified](docs/last-ten-minutes.png)

You should see something, but it might not look like much yet.

### Change the granularity

By default, the 10-minute heatmap looks at 1-second intervals. Let's make it group things into 5-second intervals.

Click the timeframe dropdown again, but this time look past all the time options. At the bottom of that dropdown, click "Granularity",
and a submenu opens.

![the granularity submenu](docs/granularity.png)

Choose 5 seconds. Do you see a picture??

Give the query a name so you can find it again!

![click on name and description](docs/name-the-query.png)

Copy the link in the URL bar, and send it to your coworkers.

### Bonus: set the default granularity for the dataset

When someone else looks at this dataset, you want them to see the picture too.
Let's make it choose 5 seconds as the granularity automatically, so people
don't have to change it every time.

The right panel has a link to Dataset Settings.

![link in right panel](docs/link-to-settings.png)

In Dataset Settings for your Happy O11ydays dataset, choose the Overview tab, and find the Default Granularity. Choose 5 seconds.

![overview tab](docs/default-granularity.png)

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

![a more typical heatmap](docs/more-typical-heatmap.png)

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

Here's a fun trick. What is different about the events that form the second reindeer?

Bring up your "heatmap(height)" graph. (You can always find your past queries in
Activity History on the left nav.)

### Bubble Up

Now click the Bubble Up tab.

Now draw a box around the second reindeer.

A bunch of little bar graphs appear below it!

The bar graphs at the top represent attributes on the second-reindeer events
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

Click the top-left attribute. A little menu pops up; choose "Group by field." (I'd include a picture, but spoilers)

Look at the GROUP BY box in the query definition, and now that attribute is in there.

Next, click the "Results" tab to get out of Bubble Up and see the groups.

Notice the table of results underneath the graph.
Each row represents one value of your attribute.

Hover over each row in the table. What happens to the picture?

As you hover over each row, the heatmap displays only the events in that group.
This makes it easy to see the difference that attribute makes in the distribution of events.

In real life, if your heatmap shows latency, and you're grouping on user_id,
then hovering over rows might reveal that response times are much slower for a few particular users.

### Bubble Up on Group By

Hover over one of the rows on the table, and then click the three dots. From there, select "BubbleUp: Compare (field name) = (value) to all other events".

Now the events in this group are yellow. Does it look right? What else is different about these events, compared to the others?

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

## Observe this program

Each run emits two traces: the entertaining one, which builds the heatmap and a picture in the trace.
The `./run` script sends them directly to Honeycomb.

You can send them to a local collector, which will send them to both Honeycomb and a local Jaeger instance.
To run a local collector and Jaeger:

`docker compose up`

and then use this script:

`./run-local`

# Use this program to draw other pictures

After you've run this program and seen our picture, you can make your own.

This code generates the heatmap image from a PNG image. You can translate a PNG of your choice into a heatmap!

## Shrink your PNG to the right size

Create an image that is:

- .png, in RGBA color format (this is pretty normal)
- 26-50 pixels tall
- about 100 pixels wide (wider is OK, but 100 is nice for a ten-minute time range)
- with a white and/or transparent background

## Get a heatmap-friendly version of your PNG

Now, run a script to setup the input files:

`./setup path/to/your/png`

If you get errors about not connecting to Honeycomb, that's OK, it means it failed to send a trace, and it doesn't matter for this script.

The setup script will

- create a directory called input/custom
- put a config.json in it
- copy in some default files for the trace view and stacked graph
- turn your PNG into what it'll look like as a heatmap.

## Tweak your PNG

Open the file `input/custom/heatmap.png`.

This should look like your input PNG, but heatmappier. Now, tweak this in a pixel editor. Change which pixels are which colors.
It'll work best if you stick with the colors in it. (There are ten possible colors plus white. Maybe they aren't all in there.
Check the code in setup.ts if you want the full list.)

Save the file.

## Run the program with your custom input

`./run input/custom/config.json`

This should make a heatmap of your image!

## Further customizations

You can change other items. This isn't fully documented but here are some hints:

`song.txt` contains lines (newline delimited) and verses delimited by 🎼 (sorry).

`house.png` contains a tree (oops) that'll show up in a stacked graph. The way this works is pretty weird.

`circle.png` contains an attempt at a circle to draw in the trace. You can make more 10-pixels-wide (ish) images, and add
them to the list of waterfall images in `config.json`. The way it works is a little weird; the first (leftmost) bar of solid color
on each row will be represented by the span, and the rest will be span events, I think.

The Christmas input is customized for attributes on the events that show in the heatmap, but how that works is _very_ weird,
so I'll change it before I try to explain it.

## Share your results

If you come up with some fun input, make a PR to this repository!

And tweet a screenshot at @honeycombio please!

[Blackbird poem](https://www.poetryfoundation.org/poems/45236/thirteen-ways-of-looking-at-a-blackbird)
