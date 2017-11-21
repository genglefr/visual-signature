# `visual signature` — Generate visually signed PDF

This project is an application that allows users to generate visually signed PDF files, thanks to touch gesture handling.


## Getting Started

To get you started you can simply clone the `visual signature` repository and install the dependencies:

### Prerequisites

You need git to clone the `visual signature` repository. You can get git from [here][git].

We also use a number of Node.js tools to initialize and test `angular-seed`. You must have Node.js
and its package manager (npm) installed. You can get them from [here][node].

### Clone `visual signature`

Clone the `visual signature` repository using git:

```
git clone https://gitlab.arhs-developments.com/Proximus/E-Solution-Support/visual-signature
cd visual-signature
```

### Install Dependencies

Simply install the bower dependencies using:

```
npm install
```

Actually, most of the dependencies have been forked because of missing features, and thus are already packaged into the app "forked_components" folder.

### Run the Application

We have preconfigured the project with a simple development web server. The simplest way to start
this server is:

```
npm start
```

Now browse to the app at [`localhost:8000/index.html`][local-app-url].


## Directory Layout

```
app/                    --> all of the source files for the application
  assets/               --> all application icons and images
  forked_components/    --> all app specific modules
  app.css               --> default stylesheet
  app.js                --> main application module
  index.html            --> app layout file (the main html template file of the app)
  worker.js             --> worker for PDF generation
karma.conf.js         --> config file for running unit tests with Karma
e2e-tests/            --> end-to-end tests
  protractor-conf.js    --> Protractor config file
  scenarios.js          --> end-to-end scenarios to be run by Protractor
```
