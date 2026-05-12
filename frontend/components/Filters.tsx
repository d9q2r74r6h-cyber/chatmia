type Props = {
    gender: string;
    setGender: (value: string) => void;
    country: string;
    setCountry: (value: string) => void;
  };
  
  export default function Filters({
    gender,
    setGender,
    country,
    setCountry
  }: Props) {
  
    return (
  
      <div className="
        mb-8
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
          Filters
        </h3>
  
        <div className="
          grid
          md:grid-cols-2
          gap-5
        ">
  
          <div>
  
            <label className="
              text-zinc-400
              text-sm
              block
              mb-2
            ">
              Gender
            </label>
  
            <select
              value={gender}
              onChange={e =>
                setGender(
                  e.target.value
                )
              }
              className="
                w-full
                bg-black
                border
                border-zinc-700
                rounded-2xl
                px-4
                py-3
                outline-none
              "
            >
  
              <option value="male">
                Male
              </option>
  
              <option value="female">
                Female
              </option>
  
              <option value="couple">
                Couple
              </option>
  
            </select>
  
          </div>
  
          <div>
  
            <label className="
              text-zinc-400
              text-sm
              block
              mb-2
            ">
              Country
            </label>
  
            <select
              value={country}
              onChange={e =>
                setCountry(
                  e.target.value
                )
              }
              className="
                w-full
                bg-black
                border
                border-zinc-700
                rounded-2xl
                px-4
                py-3
                outline-none
              "
            >
  
              <option>
                Worldwide
              </option>
  
              <option>
                USA
              </option>
  
              <option>
                Chile
              </option>
  
              <option>
                Mexico
              </option>
  
              <option>
                Spain
              </option>
  
            </select>
  
          </div>
  
        </div>
  
        <div className="
          mt-5
          bg-red-600/20
          border
          border-red-500/30
          text-red-400
          rounded-2xl
          px-5
          py-4
          text-sm
        ">
          Premium filters coming soon.
        </div>
  
      </div>
  
    );
  
  }