# 1Q Sticky Notes

> "A sticky tool that keeps everyone in sync."

This repo is my small side project to help our team be more productive. The name "1Q" comes from our team name. Many of our computers have limited internet access, and even basic tasks like copying and pasting between apps can be slow. We often end up typing everything manually, which wastes time and makes sharing files harder.

I built this small web app to make life a little easier for my team. It lets you quickly create and edit sticky notes, attach files, and see updates happen in real time for everyone using the app. You can also see who made changes to a note and who is currently active in the app. Everything stays synchronized instantly thanks to [Socket.IO](https://socket.io/). 

The app works over the local network (LAN), so all computers on the same network can stay in sync without needing the internet.

<img src="https://raw.githubusercontent.com/ndy-s/1q-sticky-notes/main/assets/diagram.png" alt="Architecture Diagram">

To allow access from outside your local network, you can set up a secure tunnel from the internet to a PC on your LAN. In my setup, I use [Ngrok](https://ngrok.com/) for simplicity. How does it work? A PC that is connected to both the LAN and the internet acts as a middleman. Other PCs on the LAN without direct internet access communicate through this middleman, while remote PCs on the internet can also connect via the same middleman. This setup allows devices on the LAN and remote devices to exchange updates through the middleman, keeping everyone synchronized even if some devices do not have direct internet access.

I also integrated it with my other project [Puppet Browser](https://github.com/ndy-s/puppet-browser), so you can open a remote browser session directly from the app while keeping your current session. I made a few small adjustments on top of the original codebase so the two projects work together smoothly.

The app is simple and light. It has just enough features to solve our main problems without being complicated. Even though it is small, it makes a real difference for our daily work.

## Getting Started

Clone the repo and install dependencies:

```bash
git clone https://github.com/ndy-s/1q-sticky-notes.git
cd 1q-sticky-notes
npm install
```

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

* PORT - the port the app will run on (default: 10101)
* SHARED_PASSWORD - required to access the site (acts as authentication so not everyone can modify notes)

Start the app:

```bash
npm run start
```

Open the app in your browser at `http://localhost:10101` and start adding sticky notes. Everyone on the network will see updates instantly.

<img src="https://raw.githubusercontent.com/ndy-s/1q-sticky-notes/main/assets/preview.png" alt="1Q Sticky Notes Preview">

## A Personal Note
To be honest, this project is not perfect yet. I built it mainly to help our small team, so the features are simple and focus only on what we really needed. Security is basic and relies on a shared password, so it's not meant for sensitive data. It works well for LAN use or a simple remote setup, but it's not a polished, full-featured product.  

Even so, it does what it was designed to do and helps us stay in sync. I might add more features in the future based on our needs or maybe not, this is the baseline for now. You may also encounter issues or features that don't work as expected, which I haven't noticed yet. Feel free to let me know or contribute through a pull request.

## License
MIT
