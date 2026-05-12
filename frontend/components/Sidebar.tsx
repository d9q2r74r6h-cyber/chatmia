type Props = {
    onlineCount: number;
    status: string;
    country: string;
  };
  
  export default function Sidebar({
    onlineCount,
    status,
    country
  }: Props) {
  
    return (
  
      <div className="
        space-y-6
      ">
  
        <div className="
          bg-zinc-900
          border
          border-zinc-800
          rounded-3xl
          p-6
        ">
  
          <h3 className="
            text-xl
            font-bold
            mb-5
          ">
            Statistics
          </h3>
  
          <div className="
            space-y-4
          ">
  
            <div className="
              flex
              items-center
              justify-between
            ">
  
              <span className="
                text-zinc-400
              ">
                Online Users
              </span>
  
              <span className="
                font-bold
                text-green-400
              ">
                {onlineCount}
              </span>
  
            </div>
  
            <div className="
              flex
              items-center
              justify-between
            ">
  
              <span className="
                text-zinc-400
              ">
                Status
              </span>
  
              <span className="
                font-bold
              ">
                {status}
              </span>
  
            </div>
  
            <div className="
              flex
              items-center
              justify-between
            ">
  
              <span className="
                text-zinc-400
              ">
                Country
              </span>
  
              <span className="
                font-bold
              ">
                {country}
              </span>
  
            </div>
  
          </div>
  
        </div>
  
        <div className="
          bg-zinc-900
          border
          border-zinc-800
          rounded-3xl
          p-6
        ">
  
          <h3 className="
            text-xl
            font-bold
            mb-5
          ">
            Community Rules
          </h3>
  
          <div className="
            space-y-3
            text-sm
            text-zinc-400
          ">
  
            <p>
              • Respect other users
            </p>
  
            <p>
              • No harassment
            </p>
  
            <p>
              • No nudity
            </p>
  
            <p>
              • Keep conversations friendly
            </p>
  
          </div>
  
        </div>
  
        <div className="
          bg-red-600/20
          border
          border-red-500/30
          rounded-3xl
          p-6
        ">
  
          <h3 className="
            text-xl
            font-bold
            mb-3
            text-red-400
          ">
            Premium
          </h3>
  
          <p className="
            text-sm
            text-zinc-300
            mb-5
          ">
            Unlock gender filters,
            HD quality and private rooms.
          </p>
  
          <button className="
            w-full
            bg-red-600
            hover:bg-red-700
            transition
            py-3
            rounded-2xl
            font-bold
          ">
            Upgrade
          </button>
  
        </div>
  
      </div>
  
    );
  
  }