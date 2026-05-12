type Props = {
    messages: string[];
    message: string;
    setMessage: (value: string) => void;
    sendMessage: () => void;
  };
  
  export default function ChatBox({
    messages,
    message,
    setMessage,
    sendMessage
  }: Props) {
  
    return (
  
      <div className="
        mt-8
        bg-zinc-900
        border
        border-zinc-800
        rounded-3xl
        p-6
      ">
  
        <div className="
          h-48
          overflow-y-auto
          mb-4
          space-y-2
        ">
  
          {messages.map((msg, i) => (
  
            <div
              key={i}
              className="
                bg-zinc-800
                rounded-xl
                px-4
                py-2
                text-sm
              "
            >
              {msg}
            </div>
  
          ))}
  
        </div>
  
        <div className="
          flex
          gap-3
        ">
  
          <input
            value={message}
            onChange={e =>
              setMessage(
                e.target.value
              )
            }
            onKeyDown={e => {
  
              if (e.key === 'Enter') {
  
                sendMessage();
  
              }
  
            }}
            placeholder="Type a message..."
            className="
              flex-1
              bg-black
              border
              border-zinc-700
              rounded-xl
              px-4
              py-3
              outline-none
            "
          />
  
          <button
            onClick={sendMessage}
            className="
              bg-red-600
              hover:bg-red-700
              transition
              px-6
              rounded-xl
              font-semibold
            "
          >
            Send
          </button>
  
        </div>
  
      </div>
  
    );
  
  }