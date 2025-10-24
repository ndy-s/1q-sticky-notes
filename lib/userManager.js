const connectedUsers = {};

function initUserManager(io) {
    const broadcast = () => {
        const users = Object.values(connectedUsers);
        io.emit('onlineUsers', users);
    };

    return {
        register: async (socketId, name) => {
            name = name.trim();
            if (!name) {
                return {
                    success: false,
                    error: 'Name cannot be empty'
                };
            }

            const duplicate = Object.entries(connectedUsers).some(
                ([id, userName]) => {
                    return userName.toLowerCase() === name.toLowerCase() && id !== socketId
                }
            );
            if (duplicate) {
                return { success: false, error: 'Name already taken' };
            }

            connectedUsers[socketId] = name;
            broadcast();
            return { success: true };
        },

        remove: (socketId) => {
            delete connectedUsers[socketId];
            broadcast();
        },

        getUsers: () => Object.values(connectedUsers)
    };
}

module.exports = { initUserManager };

