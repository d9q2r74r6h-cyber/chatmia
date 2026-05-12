export default function SearchingOverlay() {

  return (

    <div className="
      absolute
      inset-0
      bg-black/70
      backdrop-blur-sm
      flex
      flex-col
      items-center
      justify-center
      z-20
    ">

      <div className="
        w-16
        h-16
        border-4
        border-zinc-700
        border-t-red-500
        rounded-full
        animate-spin
        mb-6
      " />

      <h2 className="
        text-2xl
        font-bold
        mb-2
      ">
        Searching partner...
      </h2>

      <p className="
        text-zinc-400
      ">
        Connecting you with someone online
      </p>

    </div>

  );

}