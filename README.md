# 1Q Sticky Notes

> "A sticky tool that keeps everyone in sync."

This repo is my small side project to help our team be more productive. The name "1Q" comes from our team name. Many of our computers have limited internet access, and even basic tasks like copying and pasting between apps can be slow. We often end up typing everything manually, which wastes time and makes sharing files harder.

I built this small web app to make life a little easier for my team. It lets you quickly create and edit sticky notes, attach files, and see updates happen in real time for everyone using the app. You can also see who made changes to a note and who is currently active in the app. Everything stays synchronized instantly thanks to [Socket.IO](https://socket.io/). 

The app works over the local network (LAN), so all computers on the same network can stay in sync without needing the internet.

<img src="https://raw.githubusercontent.com/ndy-s/1q-sticky-notes/main/assets/diagram.png" alt="Architecture Diagram">

To allow access from outside your local network, you can set up a secure tunnel from the internet to a PC on your LAN. In my setup, I use [Ngrok](https://ngrok.com/) for simplicity. How does it work? A PC that is connected to both the LAN and the internet acts as a middleman. Other PCs on the LAN without direct internet access communicate through this middleman, while remote PCs on the internet can also connect via the same middleman. This setup allows devices on the LAN and remote devices to exchange updates through the middleman, keeping everyone synchronized even if some devices do not have direct internet access.

I also integrated it with my other project [Puppet Browser](https://github.com/ndy-s/puppet-browser), so you can open a remote browser session directly from the app while keeping your current session. I made a few small adjustments on top of the original codebase so the two projects work together smoothly.

The app is simple and light. It has just enough features to solve our main problems without being complicated. Even though it is small, it makes a real difference for our daily work.
