import { FieldPacket } from "mysql2";
import { DB } from "../database";
import { PoolTag } from "../mempool.interfaces"

class PoolsRepository {
  /**
   * Get all pools tagging info
   */
  public async $getPools() : Promise<PoolTag[]> {
    const connection = await DB.pool.getConnection();
    const [rows]: [PoolTag[], FieldPacket[]] = await connection.query("SELECT * FROM pools;");        
    connection.release();
    return rows;
  }

  /**
   * Get unknown pool tagging info
   */
  public getUnknownPool(): PoolTag {
    return <PoolTag>{
      id: null,
      name: 'Unknown',
      link: 'rickroll?',
      regexes: "[]",
      addresses: "[]",
    };
  } 
}

export default new PoolsRepository();